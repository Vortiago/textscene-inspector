/**
 * The spike's lit surface on one of three backends, `?renderer=`: `handler` (`WebGLRenderer` with
 * `WebGLNodesHandler`), `webgl2` (`WebGPURenderer` on its WebGL 2 backend) or `webgpu`. Every
 * backend builds the same node graph from the previewer's own modules, and reads the same DFG
 * table, a made-up sky and an atlas it draws itself. `run.mjs --out` takes the picture to compare.
 * `?boxes=400` adds a grid of boxes, and `?frames=600` times that many frames after a warm-up.
 * `?renderer=classic` draws the same meshes with three's own `MeshStandardMaterial` on a
 * `WebGLRenderer` with no handler: a frame time to measure the others against, not a picture.
 */

/* global window */ // The page runs in the browser.

import * as THREE from 'three';
import { WebGLNodesHandler } from 'three/addons/tsl/WebGLNodesHandler.js';
import { MeshBasicNodeMaterial, RenderTarget, WebGPURenderer } from 'three/webgpu';
import { dfgHalfFloats } from '../../../../packages/textscene-core/src/godot/rendering/materials/dfg.ts';
import { DFG_SIZE } from '../../../../packages/textscene-core/src/godot/rendering/materials/dfgTable.generated.ts';
import {
  GodotLitNodeMaterial,
  registerSunLightNode,
} from '../../../../packages/textscene-core/src/r3f/tslSpike/litSurfaceMaterial.ts';
import { frameTimes } from '../frameTimes.js';

const WIDTH = 640;
const HEIGHT = 480;
const ATLAS_SIZE = 1024;
const SKY_SIZE = 32;
const SKY_LAYERS = 8;
/** `NO_BLEND` of `fitDirectionalShadowSplits.ts`: the slot blends into no next slot. */
const NO_BLEND = -1e30;
const WARM_UP_FRAMES = 60;

/** The sun of `unit-directional-light-3d.tscn`. */
const SUN_BASIS = [0.866025, -0.25, 0.433013, 0, 0.866025, 0.5, -0.5, -0.433013, 0.75];

/** A light the renderers know only through the node registered for it. */
class LabSun extends THREE.Light {
  constructor(shadow) {
    super(new THREE.Color(1, 0.95, 0.85), 1.2);
    this.shadow = shadow;
    this.castShadow = true;
  }
}

function dfgTable() {
  const table = new THREE.DataTexture(
    dfgHalfFloats(),
    DFG_SIZE,
    DFG_SIZE,
    THREE.RGFormat,
    THREE.HalfFloatType
  );
  table.magFilter = table.minFilter = THREE.LinearFilter;
  table.needsUpdate = true;
  return table;
}

/** Radiance layers with no meaning, smooth in each direction and different in each layer. */
function madeUpSky() {
  const texels = new Uint16Array(SKY_SIZE * SKY_SIZE * SKY_LAYERS * 4);
  let offset = 0;
  for (let layer = 0; layer < SKY_LAYERS; layer++) {
    for (let y = 0; y < SKY_SIZE; y++) {
      for (let x = 0; x < SKY_SIZE; x++) {
        const rgba = [0.3 + (0.2 * x) / SKY_SIZE, 0.35 + (0.2 * y) / SKY_SIZE, 0.5 + 0.05 * layer, 1];
        for (const value of rgba) texels[offset++] = THREE.DataUtils.toHalfFloat(value);
      }
    }
  }
  const layers = new THREE.DataArrayTexture(texels, SKY_SIZE, SKY_SIZE, SKY_LAYERS);
  layers.format = THREE.RGBAFormat;
  layers.type = THREE.HalfFloatType;
  layers.magFilter = layers.minFilter = THREE.LinearFilter;
  layers.needsUpdate = true;
  // The ambient share, a border of none, the derivative scale, then full energy and reflection.
  const shown = new Float32Array([1, 1, SKY_SIZE * SKY_SIZE, 0, 1, 1, 0, 0]);
  return { layers, shown, rotation: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]) };
}

/** One split that holds the whole scene, in the shape the sun's node reads. */
function singleSplit(atlasMatrix) {
  const cascade = (splitEnd) => new THREE.Vector4(splitEnd, -0.003, 0.02, NO_BLEND);
  return {
    _cascadeData: [cascade(1000), cascade(2000), cascade(3000), cascade(4000)],
    getMatrix: () => atlasMatrix,
    fade: { from: 0, to: 0 },
    mapSize: new THREE.Vector2(ATLAS_SIZE, ATLAS_SIZE),
    getFrameExtents: () => new THREE.Vector2(1, 1),
    intensity: 1,
    radius: 1,
    // `WebGLRenderer`'s own shadow pass leaves a shadow that asks for no update.
    autoUpdate: false,
    needsUpdate: false,
  };
}

/**
 * Clip space to an atlas position as a node counts it, rows from the top on every backend, and to
 * the depth the backend stores: half of z plus a half under WebGL's clip space, z under WebGPU's.
 */
function clipToAtlas(coordinateSystem) {
  const depth = coordinateSystem === THREE.WebGPUCoordinateSystem ? [1, 0] : [0.5, 0.5];
  return new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, -0.5, 0, 0.5, 0, 0, depth[0], depth[1], 0, 0, 0, 1);
}

async function createRenderer(name, canvas) {
  if (name === 'classic') return new THREE.WebGLRenderer({ canvas, antialias: false });
  if (name === 'handler') {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    renderer.setNodesHandler(new WebGLNodesHandler());
    return renderer;
  }
  const renderer = new WebGPURenderer({ canvas, antialias: false, forceWebGL: name === 'webgl2' });
  await renderer.init();
  return renderer;
}

function isClassicRenderer(name) {
  return name === 'handler' || name === 'classic';
}

function createAtlas(name) {
  const depthTexture = new THREE.DepthTexture(ATLAS_SIZE, ATLAS_SIZE);
  depthTexture.compareFunction = THREE.LessEqualCompare;
  const options = { depthTexture };
  return isClassicRenderer(name)
    ? new THREE.WebGLRenderTarget(ATLAS_SIZE, ATLAS_SIZE, options)
    : new RenderTarget(ATLAS_SIZE, ATLAS_SIZE, options);
}

function addBoxes(scene, material, count) {
  const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  const side = Math.ceil(Math.sqrt(count));
  for (let index = 0; index < count; index++) {
    const box = new THREE.Mesh(geometry, material);
    box.receiveShadow = true;
    box.position.set(((index % side) / side - 0.5) * 5, -0.95, (Math.floor(index / side) / side - 0.5) * 5);
    scene.add(box);
  }
}

export async function run(canvas) {
  const query = new URLSearchParams(window.location.search);
  const name = query.get('renderer') ?? 'handler';
  const startedAt = performance.now();
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const renderer = await createRenderer(name, canvas);
  renderer.shadowMap.enabled = true;

  const atlas = createAtlas(name);
  const atlasMatrix = new THREE.Matrix4();
  const sun = new LabSun(singleSplit(atlasMatrix));
  sun.matrixAutoUpdate = false;
  sun.matrix.makeBasis(
    new THREE.Vector3(SUN_BASIS[0], SUN_BASIS[3], SUN_BASIS[6]),
    new THREE.Vector3(SUN_BASIS[1], SUN_BASIS[4], SUN_BASIS[7]),
    new THREE.Vector3(SUN_BASIS[2], SUN_BASIS[5], SUN_BASIS[8])
  );
  // The node reads the direction to the sun from the world position, as three's sun path does.
  sun.matrix.setPosition(SUN_BASIS[2], SUN_BASIS[5], SUN_BASIS[8]);
  registerSunLightNode(LabSun, { atlas: atlas.depthTexture, atlasCoord: (uv) => uv });

  const inputs = { dfgTable: dfgTable(), sky: madeUpSky(), sunShadow: null };
  const litMaterial = (diffuseMode) =>
    name === 'classic' ? new THREE.MeshStandardMaterial() : new GodotLitNodeMaterial(inputs, diffuseMode);
  const groundMaterial = litMaterial('burley');
  groundMaterial.color.setRGB(0.75, 0.75, 0.75);
  const markerMaterial = litMaterial('lambert');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0.05, 0.05, 0.05);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1;
  const marker = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), markerMaterial);
  marker.position.y = -0.5;
  // A light node builds its shadow only for an object that receives one.
  ground.receiveShadow = marker.receiveShadow = true;
  scene.add(ground, marker, sun);
  addBoxes(scene, markerMaterial, Number(query.get('boxes') ?? 0));

  const camera = new THREE.PerspectiveCamera(50, WIDTH / HEIGHT, 0.1, 100);
  camera.position.set(-5, 3, 2);
  camera.lookAt(0, -0.5, 0);

  const sunCamera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 30);
  sunCamera.position.set(SUN_BASIS[2], SUN_BASIS[5], SUN_BASIS[8]).multiplyScalar(12);
  sunCamera.lookAt(0, 0, 0);
  const depthOnly = isClassicRenderer(name) ? new THREE.MeshBasicMaterial() : new MeshBasicNodeMaterial();

  function drawFrame() {
    scene.overrideMaterial = depthOnly;
    scene.background = null;
    renderer.setRenderTarget(atlas);
    renderer.render(scene, sunCamera);
    renderer.setRenderTarget(null);
    scene.overrideMaterial = null;
    scene.background = BACKGROUND;
    // After the atlas draw: a renderer gives the camera its clip space when it draws with it.
    atlasMatrix
      .copy(clipToAtlas(sunCamera.coordinateSystem))
      .multiply(sunCamera.projectionMatrix)
      .multiply(sunCamera.matrixWorldInverse);
    renderer.render(scene, camera);
  }
  const BACKGROUND = scene.background;

  drawFrame();
  const firstFrameMs = performance.now() - startedAt;
  const frames = Number(query.get('frames') ?? 0);
  const timed = frames > 0 ? await frameTimes(renderer, drawFrame, WARM_UP_FRAMES, frames) : null;
  // A screenshot reads what the page presents, so the page keeps drawing after it reports.
  renderer.setAnimationLoop(drawFrame);
  return { renderer: name, firstFrameMs, timed };
}
