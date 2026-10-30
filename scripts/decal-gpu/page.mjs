/**
 * The browser side of the decal gate: draws made-up scenes through the real scene decals and the
 * patched programs, and reads back the pixel each scene is about. A top-down orthographic camera
 * maps one world unit in x and z to a fixed number of pixels, so a scene names the point it samples.
 */
import * as THREE from 'three';
import { installShaderPatches } from '../../packages/textscene-core/src/r3f/shaderPatch/installShaderPatches.ts';
import { DecalObject } from '../../packages/textscene-core/src/r3f/decal/decalObject.ts';
import { SceneDecals } from '../../packages/textscene-core/src/r3f/decal/sceneDecals.ts';
import { parseDecal } from '../../packages/textscene-core/src/nodes/3d/decal/parser.ts';
import {
  holdDecalTexture,
  releaseDecalTexture,
} from '../../packages/textscene-core/src/nodes/3d/decal/decalAtlas.ts';
import { markEditorHelper } from '../../packages/textscene-core/src/r3f/editorHelpers.ts';
import { setVisualLayers } from '../../packages/textscene-core/src/r3f/visualLayers.ts';
import {
  poseColourDraw,
  surfaceDrawHooks,
  UNRANGED_INSTANCE,
} from '../../packages/textscene-core/src/r3f/surfaceDrawHooks.ts';
import { MAX_DECALS } from '../../packages/textscene-core/src/r3f/decal/decalRows.ts';

/* global window, document */
// `window` and `document` exist only in the browser that loads this page.

/** Pixels in each direction of the view, which spans `VIEW_SIZE` world units. */
const PIXELS = 64;
const VIEW_SIZE = 4;
const CAMERA_HEIGHT = 10;

const RED = [255, 0, 0];
const GREEN = [0, 255, 0];
/** The grey of the receivers in bytes, so a decal of it changes no albedo and shows only what its maps do. */
const RECEIVER_GREY = [128, 128, 128];
/** A normal map texel that lies along the decal's X axis, flat to the surface (`:1619`). */
const NORMAL_ALONG_X = [255, 128, 128];
/** Normal map texels that tilt the surface fully one way and fully the other, flat between them in bytes. */
const NORMAL_TILTS = [
  [0, 128, 128],
  [255, 128, 128],
];
/** The normal map texel that lies flat to the surface. */
const NORMAL_FLAT = [128, 128, 128];

installShaderPatches();
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas') });
const target = new THREE.WebGLRenderTarget(PIXELS, PIXELS, { type: THREE.UnsignedByteType });

const camera = new THREE.OrthographicCamera(
  -VIEW_SIZE / 2,
  VIEW_SIZE / 2,
  VIEW_SIZE / 2,
  -VIEW_SIZE / 2,
  0.1,
  50
);
camera.position.set(0, CAMERA_HEIGHT, 0);
camera.up.set(0, 0, -1);
camera.lookAt(0, 0, 0);

/** The linear RGB of the pixel at world (x, z) after `scene` renders. */
function pixelAt(scene, x, z) {
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  const bytes = new Uint8Array(4);
  const column = Math.floor(((x + VIEW_SIZE / 2) / VIEW_SIZE) * PIXELS);
  const row = Math.floor(((-z + VIEW_SIZE / 2) / VIEW_SIZE) * PIXELS);
  renderer.readRenderTargetPixels(target, column, row, 1, 1, bytes);
  return Array.from(bytes.slice(0, 3), (byte) => byte / 255);
}

/** A texture of `width` texels across, one colour in bytes for each, which the decal atlas holds while `held` lists it. */
function colourTexture(colours, width, held) {
  const data = new Uint8Array(colours.length * 4);
  colours.forEach((rgb, texel) => data.set([...rgb, 255], texel * 4));
  const texture = new THREE.DataTexture(data, width, colours.length / width, THREE.RGBAFormat);
  texture.needsUpdate = true;
  holdDecalTexture(texture);
  held.push(texture);
  return texture;
}

/** A map is the bytes of one colour, or a row of such colours. */
function mapTexture(bytes, held) {
  return Array.isArray(bytes[0])
    ? colourTexture(bytes, bytes.length, held)
    : colourTexture(Array(16).fill(bytes), 4, held);
}

/**
 * Runs `scenario` with a fresh scene that has a light, its scene decals and a way to add decals
 * and receivers, then lets go of everything the scenario held. `ambient` adds an ambient light of
 * that intensity, which only an indirect term reads.
 */
function inScene(scenario, { ambient = 0 } = {}) {
  const scene = new THREE.Scene();
  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(0, 5, 0);
  scene.add(light);
  if (ambient > 0) scene.add(new THREE.AmbientLight(0xffffff, ambient));
  const held = [];
  const sceneDecals = new SceneDecals(renderer, scene);
  let treeOrder = 0;
  const decals = [];
  const kit = {
    scene,
    /** The pixel at (x, z) with the decals, and with them hidden: what the shading draws alone. */
    sampleAt(x, z) {
      const drawn = pixelAt(scene, x, z);
      for (const decal of decals) decal.visible = false;
      const bare = pixelAt(scene, x, z);
      for (const decal of decals) decal.visible = true;
      return { drawn, bare };
    },
    /**
     * A decal at `position`, taller than the receivers so the fades stay at 1. `rgb` is its albedo
     * in bytes, none for null, and `maps` gives the bytes of its other maps.
     */
    addDecal(rgb, position, properties = {}, maps = {}) {
      const decal = new DecalObject();
      decal.look = parseDecal(
        { type: 'node', attributes: { type: 'Decal', name: 'D' } },
        { size: 'Vector3(2, 4, 2)', upper_fade: '0', lower_fade: '0', ...properties }
      );
      decal.textures.albedo = rgb && mapTexture(rgb, held);
      for (const [map, bytes] of Object.entries(maps)) decal.textures[map] = mapTexture(bytes, held);
      decal.treeOrder = [treeOrder++];
      decal.position.set(...position);
      scene.add(decal);
      decals.push(decal);
      return decal;
    },
  };
  try {
    return scenario(kit);
  } finally {
    sceneDecals.dispose();
    for (const texture of held) releaseDecalTexture(texture);
  }
}

const plane = (width, depth) => new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2);
const standard = (parameters = {}) => new THREE.MeshStandardMaterial({ color: 0x808080, ...parameters });
const unshaded = () => new THREE.MeshBasicMaterial({ color: 0x808080 });

/**
 * A receiver under a decal: the pixel inside its box, and one the box does not reach. The decal
 * is a red albedo unless `decal` names its `albedo` in bytes, none for null, its `maps` and its
 * `properties`.
 */
function receiver(makeMaterial, decal = {}, sceneOptions = {}) {
  const { albedo = RED, maps = {}, properties = {} } = decal;
  return inScene(({ scene, addDecal, sampleAt }) => {
    scene.add(new THREE.Mesh(plane(4, 4), makeMaterial()));
    addDecal(albedo, [0, 0.5, 0], properties, maps);
    return { inside: sampleAt(0, 0), outside: sampleAt(1.5, 1.5) };
  }, sceneOptions);
}

/** A decal moved by its transform alone, with no change to its props, before the next render. */
function motion() {
  return inScene(({ scene, addDecal, sampleAt }) => {
    scene.add(new THREE.Mesh(plane(4, 4), standard()));
    const decal = addDecal(RED, [-1, 0.5, 0]);
    const before = { oldPlace: sampleAt(-1, 0), newPlace: sampleAt(1, 0) };
    decal.position.x = 1;
    return { before, after: { oldPlace: sampleAt(-1, 0), newPlace: sampleAt(1, 0) } };
  });
}

/** `moveIn` brings a receiver outside the box into it, and the pixel is sampled either side. */
function receiverMoving(addReceiver) {
  return inScene(({ scene, addDecal, sampleAt }) => {
    addDecal(RED, [0, 0.5, 0]);
    const moveIn = addReceiver(scene);
    const before = sampleAt(0, 0);
    moveIn();
    return { before, after: sampleAt(0, 0) };
  });
}

const movingSurface = (scene) => {
  const mesh = new THREE.Mesh(plane(4, 4), standard());
  mesh.position.y = 3;
  scene.add(mesh);
  return () => {
    mesh.position.y = 0;
  };
};

const skinnedSurface = (scene) => {
  const geometry = plane(4, 4);
  const count = geometry.attributes.position.count;
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(count * 4), 4));
  geometry.setAttribute(
    'skinWeight',
    new THREE.Float32BufferAttribute(
      Float32Array.from({ length: count * 4 }, (_, i) => (i % 4 === 0 ? 1 : 0)),
      4
    )
  );
  const bone = new THREE.Bone();
  bone.position.y = 3;
  const mesh = new THREE.SkinnedMesh(geometry, standard());
  mesh.add(bone);
  // Identity bind inverses, so the bone's own height lifts every vertex by it.
  mesh.bind(new THREE.Skeleton([bone], [new THREE.Matrix4()]), new THREE.Matrix4());
  scene.add(mesh);
  return () => {
    bone.position.y = 0;
  };
};

/** The chrome and the surface that sit above one decal side by side. */
function editorChrome() {
  return inScene(({ scene, addDecal, sampleAt }) => {
    addDecal(RED, [0, 0.5, 0]);
    const chrome = new THREE.Group();
    markEditorHelper(chrome);
    const chromeMesh = new THREE.Mesh(plane(1.5, 4), new THREE.MeshBasicMaterial({ color: 0x808080 }));
    chromeMesh.position.set(-0.75, 0.2, 0);
    chrome.add(chromeMesh);
    const surface = new THREE.Mesh(plane(1.5, 4), new THREE.MeshBasicMaterial({ color: 0x808080 }));
    surface.position.set(0.75, 0.2, 0);
    scene.add(chrome, surface);
    return { chrome: sampleAt(-0.5, 0), surface: sampleAt(0.5, 0) };
  });
}

/** A receiver on layer 2 under a decal with `mask`. */
function maskedReceiver(mask) {
  return inScene(({ scene, addDecal, sampleAt }) => {
    addDecal(RED, [0, 0.5, 0], { cull_mask: String(mask) });
    const mesh = new THREE.Mesh(plane(4, 4), standard());
    setVisualLayers(mesh, 2);
    Object.assign(
      mesh,
      surfaceDrawHooks({ colourDraw: poseColourDraw, shadowSide: () => {} }, UNRANGED_INSTANCE)
    );
    scene.add(mesh);
    return sampleAt(0, 0);
  });
}

/** Two overlapping decals, the green one nearer, and the red one's sorting offset. */
function nearestOnTop(redOffset) {
  return inScene(({ scene, addDecal, sampleAt }) => {
    scene.add(new THREE.Mesh(plane(4, 4), standard()));
    addDecal(RED, [0, 0.5, 0], { sorting_offset: String(redOffset) });
    addDecal(GREEN, [0, 1, 0]);
    return sampleAt(0, 0);
  });
}

/**
 * `count` red decals, nearest first, and a green one farther than all. A group of 32 mixes its
 * highest row first, so with 33 the farthest mixes last and shows over the 32 nearer ones.
 */
function redUnderFarGreen(count, spacing) {
  return inScene(({ scene, addDecal, sampleAt }) => {
    scene.add(new THREE.Mesh(plane(4, 4), standard()));
    for (let i = 0; i < count; i += 1) addDecal(RED, [0, 1 - i * spacing, 0]);
    addDecal(GREEN, [0, 0.5, 0]);
    return sampleAt(0, 0);
  });
}

/** A receiver with an ambient light and an AO map of white, so an indirect term shows what an ORM map occludes. */
function aoMapMaterial() {
  const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
  white.needsUpdate = true;
  return standard({ aoMap: white });
}

/** The ORM bytes of full occlusion, the roughest surface and no metal. */
const ORM_OCCLUDED = [0, 255, 0];
/** The ORM bytes of no occlusion, the roughest surface and a metal. */
const ORM_METALLIC = [255, 255, 255];

/** A decal with an emission map and no albedo. */
const EMISSION_ONLY = { albedo: null, maps: { emission: RED } };

const AMBIENT_SCENE = { ambient: 3 };

window.decalSamples = () => ({
  lit: receiver(standard),
  physical: receiver(() => new THREE.MeshPhysicalMaterial({ color: 0x808080 })),
  unshaded: receiver(unshaded),
  transparent: receiver(() => standard({ transparent: true, opacity: 0.5 })),
  doubleSided: receiver(() => standard({ side: THREE.DoubleSide })),
  motion: motion(),
  receiverMoves: receiverMoving(movingSurface),
  skinnedReceiver: receiverMoving(skinnedSurface),
  editorChrome: editorChrome(),
  maskCleared: maskedReceiver(0xffffd),
  maskKept: maskedReceiver(0xfffff),
  nearestOnTop: nearestOnTop(0),
  sortingOffset: nearestOnTop(2),
  groupsOf32: redUnderFarGreen(32, 0.001),
  limit: redUnderFarGreen(MAX_DECALS, 0.0001),
  emission: {
    lit: receiver(standard, EMISSION_ONLY),
    physical: receiver(() => new THREE.MeshPhysicalMaterial({ color: 0x808080 }), {
      albedo: null,
      maps: { emission: RED },
    }),
    unshaded: receiver(unshaded, {
      albedo: null,
      maps: { emission: RED },
    }),
    withAlbedo: receiver(standard, { albedo: RECEIVER_GREY, maps: { emission: RED } }),
    noEnergy: receiver(standard, {
      albedo: null,
      maps: { emission: RED },
      properties: { emission_energy: '0' },
    }),
  },
  normalOnly: receiver(standard, { albedo: null, maps: { normal: NORMAL_ALONG_X } }),
  ormOnly: receiver(standard, { albedo: null, maps: { orm: ORM_METALLIC } }),
  normalMap: {
    lit: receiver(standard, { albedo: RECEIVER_GREY, maps: { normal: NORMAL_ALONG_X } }),
    unshaded: receiver(unshaded, {
      albedo: RECEIVER_GREY,
      maps: { normal: NORMAL_ALONG_X },
    }),
  },
  magnifiedNormal: {
    between: receiver(standard, { albedo: RECEIVER_GREY, maps: { normal: NORMAL_TILTS } }),
    flat: receiver(standard, { albedo: RECEIVER_GREY, maps: { normal: NORMAL_FLAT } }),
  },
  ormMap: {
    metallic: receiver(standard, { albedo: RECEIVER_GREY, maps: { orm: ORM_METALLIC } }),
    occlusion: receiver(standard, { albedo: RECEIVER_GREY, maps: { orm: ORM_OCCLUDED } }, AMBIENT_SCENE),
    occlusionOfAoMap: receiver(
      aoMapMaterial,
      { albedo: RECEIVER_GREY, maps: { orm: ORM_OCCLUDED } },
      AMBIENT_SCENE
    ),
    unshaded: receiver(unshaded, {
      albedo: RECEIVER_GREY,
      maps: { orm: ORM_METALLIC },
    }),
  },
});
