import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyShadowCasting, rangedShadowCastingEffects, shadowCastingEffects } from './shadowCasting';
import { GODOT_ALPHA_HASH } from './materials/godotAlphaHash';
import { withPointDraw } from './materials/godotPoint';
import { patchedUniforms, programShader } from './testing/patchedFragment';
import { instanceLayers } from './instanceLayers/instanceLayersChunk';
import { shownProbes } from './reflectionProbe/probeSlots';
import { setVisualLayers } from './visualLayers';
import { testRenderer } from '../testing/recordingWebGL';
import { ShadowCastingSetting } from '../godot/rendering/rendering';
import { BillboardMode } from '../godot/rendering/materials/billboardMode';
import { SHADOW_PASS_OPAQUE_THRESHOLD } from '../godot/rendering/opaquePrepass';
import { standardMaterial as material } from '../resources/materials/standardmaterial3d/testing/standardMaterial';
import {
  castsFrom,
  drawColourGroup,
  drawsColour,
  drawShadowGroup,
  expectSameMatrix,
  groupMaterialAt,
  TEST_CAMERA as camera,
  TEST_SHADOW_CAMERA as shadowCamera,
} from './testing/threePasses';

const OPAQUE = 0;
const ADDITIVE = 1;
const BILLBOARD = 2;
const ALPHA_BLENDED = 4;
const DEPTH_PRE_PASS = 5;

/**
 * One draw group per surface kind, each with its own material, and a yawed,
 * offset pose, so a billboard that leaks into another group shows.
 */
function surfacesMesh(castShadow: number | undefined = ShadowCastingSetting.ON): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  const materials = [
    material(),
    material({ blend_mode: '1' }),
    material({ billboard_mode: '1' }),
    material({ billboard_mode: '3' }),
    material({ transparency: '1' }),
    material({ transparency: '4' }),
  ];
  materials.forEach((_material, i) => geometry.addGroup(i * 6, 6, i));
  const mesh = new THREE.Mesh(geometry, materials);
  applyShadowCasting(mesh, shadowCastingEffects(castShadow));
  mesh.position.set(5, 6, 7);
  mesh.rotation.set(0, Math.PI / 2, 0);
  mesh.updateMatrixWorld(true);
  return mesh;
}

describe('surfaceDrawHooks — colour pass billboard', () => {
  it('draws a billboarding group in the object pose, which its program billboards', () => {
    const mesh = surfacesMesh();
    const drawn = drawColourGroup(mesh, camera, BILLBOARD, (s) => s.matrixWorld);
    expect(drawn.equals(mesh.matrixWorld)).toBe(true);
  });

  it('aims the billboard at the camera of the colour pass', () => {
    const mesh = surfacesMesh();
    const aimed = drawColourGroup(mesh, camera, BILLBOARD, () =>
      mainCameraOf(groupMaterialAt(mesh, BILLBOARD))
    );
    expect(aimed.equals(camera.matrixWorld)).toBe(true);
  });

  it('leaves the model-view three computed for the draw, not a stale one from before it', () => {
    // three recomputes `modelViewMatrix` after the before-hook (`WebGLRenderer.js:2160`)
    // and `normalMatrix` from it, so the pair must stay as the draw left them.
    const mesh = surfacesMesh();
    mesh.modelViewMatrix.makeScale(9, 9, 9);
    const drawn = drawColourGroup(mesh, camera, BILLBOARD, (s) => s.modelViewMatrix);
    expect(mesh.modelViewMatrix.equals(drawn)).toBe(true);
  });
});

/** The main camera the billboard of `material`'s program reads now. */
function mainCameraOf(material: THREE.Material): THREE.Matrix4 {
  return patchedUniforms(material).godotMainCameraWorld!.value as THREE.Matrix4;
}

/** The pass camera the billboard of `material`'s program reads now. */
function passCameraOf(material: THREE.Material): THREE.Matrix4 {
  return patchedUniforms(material).godotPassCameraWorld!.value as THREE.Matrix4;
}

/** A plain mesh and an InstancedMesh of one billboarding surface in `mode`, which cast. */
const BILLBOARD_DRAWS: readonly [string, (mode?: number) => THREE.Mesh][] = [
  ['a plain draw', (mode = BillboardMode.BILLBOARD_ENABLED) => castingDraw(new THREE.Mesh(), mode)],
  [
    'an instanced draw',
    (mode = BillboardMode.BILLBOARD_ENABLED) =>
      castingDraw(new THREE.InstancedMesh(undefined, undefined, 2), mode),
  ],
];

function castingDraw(mesh: THREE.Mesh, mode: number): THREE.Mesh {
  mesh.geometry = new THREE.BufferGeometry();
  mesh.material = material({ billboard_mode: String(mode) });
  applyShadowCasting(mesh, shadowCastingEffects(ShadowCastingSetting.ON));
  mesh.position.set(5, 6, 7);
  mesh.rotation.set(0, Math.PI / 2, 0);
  mesh.updateMatrixWorld(true);
  return mesh;
}

describe.each(BILLBOARD_DRAWS)('surfaceDrawHooks — shadow pass billboard of %s', (_name, billboarding) => {
  // Godot's shadow pass runs the billboard of the colour pass (`material.cpp:1309`).
  it('casts with its own depth material, which billboards the draw', () => {
    const { cast, castsOwn, threeDraws } = shadowDraw(billboarding());
    const shader = programShader('depth');
    cast.onBeforeCompile.call(cast, shader as never, undefined as never);
    expect([castsOwn, threeDraws, shader.vertexShader]).toEqual([
      true,
      false,
      expect.stringContaining('mat4 godotBillboardWorld = godotBillboard();'),
    ]);
  });

  it('keeps the object pose, which the program billboards', () => {
    const mesh = billboarding();
    const drawn = drawShadowGroup(mesh, camera, shadowCamera, 0, (s) => s.matrixWorld.clone());
    expect(drawn.equals(mesh.matrixWorld)).toBe(true);
  });

  // `MAIN_CAM_INV_VIEW_MATRIX` is the main camera's on a shadow pass too (`material.cpp:1263-1264`).
  it('aims the billboard at the main camera, not the light', () => {
    const mesh = billboarding();
    const aimed = drawShadowGroup(mesh, camera, shadowCamera, 0, () =>
      mainCameraOf(groupMaterialAt(mesh, 0))
    );
    expect([aimed.equals(camera.matrixWorld), aimed.equals(shadowCamera.matrixWorld)]).toEqual([true, false]);
  });

  // PARTICLES reads `INV_VIEW_MATRIX`, the camera of the pass it draws in (`material.cpp:1309-1312`).
  it('aims a PARTICLES billboard at the light', () => {
    const mesh = billboarding(BillboardMode.BILLBOARD_PARTICLES);
    const aimed = drawShadowGroup(mesh, camera, shadowCamera, 0, () =>
      passCameraOf(groupMaterialAt(mesh, 0))
    );
    expect([aimed.equals(shadowCamera.matrixWorld), aimed.equals(camera.matrixWorld)]).toEqual([true, false]);
  });
});

/** The object-space uniform of `material` once it compiles Godot's hash. */
function hashObjectSpace(material: THREE.Material): THREE.Matrix4 {
  const shader = programShader('standard');
  GODOT_ALPHA_HASH.onBeforeCompile.call(material, shader);
  return shader.uniforms.godotObjectFromModel!.value as THREE.Matrix4;
}

describe('surfaceDrawHooks — alpha hash object space', () => {
  it('hashes a billboarding group in the object space of its unposed node', () => {
    const mesh = surfacesMesh();
    const objectSpace = hashObjectSpace(groupMaterialAt(mesh, BILLBOARD));
    const drawn = drawColourGroup(mesh, camera, BILLBOARD, (s) => s.matrixWorld);
    expectSameMatrix(objectSpace, mesh.matrixWorld.clone().invert().multiply(drawn));
  });

  it("hashes in the node pose the instance gives, which a node's billboard never moves", () => {
    const mesh = surfacesMesh();
    const node = new THREE.Matrix4().makeTranslation(5, 6, 7);
    applyShadowCasting(
      mesh,
      rangedShadowCastingEffects(ShadowCastingSetting.ON, {
        isVisible: true,
        nodeMatrixWorld: (target) => (target.copy(node), true),
      })
    );
    const objectSpace = hashObjectSpace(groupMaterialAt(mesh, OPAQUE));
    drawColourGroup(mesh, camera, OPAQUE, () => undefined);
    expectSameMatrix(objectSpace, node.clone().invert().multiply(mesh.matrixWorld));
  });

  it('hashes a group three draws in the node pose in its own vertex space (edge case)', () => {
    const mesh = surfacesMesh();
    const objectSpace = hashObjectSpace(groupMaterialAt(mesh, OPAQUE));
    objectSpace.makeScale(3, 3, 3);
    drawColourGroup(mesh, camera, OPAQUE, () => undefined);
    expectSameMatrix(objectSpace, new THREE.Matrix4());
  });
});

describe('surfaceDrawHooks — shadow pass alpha-pass exclusion', () => {
  it('draws nothing into the shadow map for a non-MIX blend mode', () => {
    const mesh = surfacesMesh();
    expect(castsFrom(mesh, ADDITIVE)).toBe(false);
  });

  it('draws nothing into the shadow map for an alpha-blended group', () => {
    const mesh = surfacesMesh();
    expect(castsFrom(mesh, ALPHA_BLENDED)).toBe(false);
  });

  it('draws a depth-prepass group, which Godot keeps in the shadow pass', () => {
    const mesh = surfacesMesh();
    expect(castsFrom(mesh, DEPTH_PRE_PASS)).toBe(true);
  });

  it('draws an opaque group of the same mesh', () => {
    const mesh = surfacesMesh();
    expect(castsFrom(mesh, OPAQUE)).toBe(true);
  });

  it('hands the shared geometry back with its draw range', () => {
    const mesh = surfacesMesh();
    const count = mesh.geometry.drawRange.count;
    castsFrom(mesh, ADDITIVE);
    expect(mesh.geometry.drawRange.count).toBe(count);
  });
});

/** A mesh of one surface, which casts. */
function surfaceMesh(properties: Record<string, string>): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material(properties));
  applyShadowCasting(mesh, shadowCastingEffects(ShadowCastingSetting.ON));
  return mesh;
}

/** The material the group at `group` casts with, whether it is the hooks' own, and whether three's draw still draws. */
function shadowDraw(mesh: THREE.Mesh, group = 0) {
  return drawShadowGroup(mesh, camera, shadowCamera, group, (s) => ({
    cast: s.castMaterial!,
    castsOwn: s.castMaterial !== s.depthMaterial,
    threeDraws: mesh.geometry.drawRange.count > 0,
  }));
}

describe('surfaceDrawHooks — shadow alpha cut', () => {
  it("cuts a depth-prepass group's shadow at the shadow pass's prepass threshold", () => {
    const { cast } = shadowDraw(surfacesMesh(), DEPTH_PRE_PASS);
    expect(cast.alphaTest).toBe(SHADOW_PASS_OPAQUE_THRESHOLD);
  });

  it("cuts a scissor surface's shadow at its own threshold, with its opacity", () => {
    const { cast } = shadowDraw(
      surfaceMesh({ transparency: '2', alpha_scissor_threshold: '0.3', albedo_color: 'Color(1, 1, 1, 0.6)' })
    );
    expect(cast.alphaTest).toBeCloseTo(0.3, 6);
    expect(cast.opacity).toBeCloseTo(0.6, 6);
  });

  it("casts a hashed surface's shadow through the hash", () => {
    expect(shadowDraw(surfaceMesh({ transparency: '3' })).cast.alphaHash).toBe(true);
  });

  it("skips three's own draw of a surface the hooks cast themselves", () => {
    expect(shadowDraw(surfaceMesh({ transparency: '2' })).threeDraws).toBe(false);
  });

  it("leaves an uncut surface to three's depth material (edge case)", () => {
    const { castsOwn, threeDraws } = shadowDraw(surfacesMesh(), OPAQUE);
    expect([castsOwn, threeDraws]).toEqual([false, true]);
  });
});

describe('surfaceDrawHooks — point shadow', () => {
  /** A THREE.Points of one surface sized `pixels`, which casts, typed as the mesh the helpers take. */
  function pointsSurface(): THREE.Mesh {
    const userData = withPointDraw(
      { materialClass: 'standard', props: {} },
      { pixels: 100, pixelRatio: 1, samplesAlbedoAtPointCoord: false, placement: 'mesh' }
    ).props.userData;
    const points = new THREE.Points(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ userData }));
    applyShadowCasting(points, shadowCastingEffects(ShadowCastingSetting.ON));
    return points as unknown as THREE.Mesh;
  }

  // Godot rasterises a point into its shadow map at the material's point size.
  it("casts a point's shadow with its own depth material, which writes the point size", () => {
    const { cast, castsOwn, threeDraws } = shadowDraw(pointsSurface());
    const shader = programShader('depth');
    cast.onBeforeCompile.call(cast, shader as never, undefined as never);
    expect([castsOwn, threeDraws, shader.vertexShader]).toEqual([
      true,
      false,
      expect.stringContaining('gl_PointSize = godotPointSize;'),
    ]);
  });
});

// Godot billboards each instance about its own origin, so a billboard about the node would move
// every instance of a points draw (edge case).
describe('surfaceDrawHooks — instanced points billboard', () => {
  it('keeps the pose of instanced points', () => {
    const points = new THREE.Points(new THREE.InstancedBufferGeometry(), material({ billboard_mode: '1' }));
    applyShadowCasting(points, shadowCastingEffects(ShadowCastingSetting.ON));
    points.position.set(5, 6, 7);
    points.rotation.set(0, Math.PI / 2, 0);
    points.updateMatrixWorld(true);
    const drawn = points as unknown as THREE.Mesh;
    expect(drawColourGroup(drawn, camera, 0, (s) => s.matrixWorld.clone()).equals(points.matrixWorld)).toBe(
      true
    );
  });
});

describe('surfaceDrawHooks — cast_shadow', () => {
  it('keeps DOUBLE_SIDED forcing both faces into the depth pass', () => {
    const mesh = surfacesMesh(ShadowCastingSetting.DOUBLE_SIDED);
    const side = drawShadowGroup(mesh, camera, shadowCamera, OPAQUE, (s) => s.depthMaterial!.side);
    expect(side).toBe(THREE.DoubleSide);
  });

  it('keeps the material cull for ON', () => {
    const mesh = surfacesMesh(ShadowCastingSetting.ON);
    const side = drawShadowGroup(mesh, camera, shadowCamera, OPAQUE, (s) => s.depthMaterial!.side);
    expect(side).toBe(THREE.FrontSide);
  });

  it('SHADOWS_ONLY draws nothing in the colour pass', () => {
    const mesh = surfacesMesh(ShadowCastingSetting.SHADOWS_ONLY);
    expect(drawsColour(mesh, OPAQUE)).toBe(false);
  });

  it('SHADOWS_ONLY hands the shared geometry back with its draw range', () => {
    const mesh = surfacesMesh(ShadowCastingSetting.SHADOWS_ONLY);
    const count = mesh.geometry.drawRange.count;
    drawsColour(mesh, OPAQUE);
    expect(mesh.geometry.drawRange.count).toBe(count);
  });

  it('SHADOWS_ONLY still casts from an opaque group', () => {
    const mesh = surfacesMesh(ShadowCastingSetting.SHADOWS_ONLY);
    expect(castsFrom(mesh, OPAQUE)).toBe(true);
  });

  it('ON draws the colour pass', () => {
    const mesh = surfacesMesh(ShadowCastingSetting.ON);
    expect(drawsColour(mesh, OPAQUE)).toBe(true);
  });
});

describe('surfaceDrawHooks — instanced meshes', () => {
  it('leaves an InstancedMesh in its own pose, which would billboard about the batch origin', () => {
    // three multiplies `instanceMatrix` after `modelMatrix`, so one swapped matrix
    // would turn every instance about the batch origin, not each about its own.
    const instanced = new THREE.InstancedMesh(
      new THREE.BufferGeometry(),
      material({ billboard_mode: '1' }),
      2
    );
    applyShadowCasting(instanced, shadowCastingEffects(ShadowCastingSetting.ON));
    instanced.position.set(5, 6, 7);
    instanced.updateMatrixWorld(true);
    const drawn = drawColourGroup(instanced, camera, 0, (s) => s.matrixWorld);
    expect(drawn.equals(instanced.matrixWorld)).toBe(true);
  });
});

describe('surfaceDrawHooks — identity', () => {
  it('returns the same hooks for the same cast_shadow, so a mesh prop never churns', () => {
    const first = shadowCastingEffects(ShadowCastingSetting.ON);
    const second = shadowCastingEffects(ShadowCastingSetting.ON);
    expect(second.onBeforeRender).toBe(first.onBeforeRender);
    expect(second.onBeforeShadow).toBe(first.onBeforeShadow);
  });
});

describe('surfaceDrawHooks — instance layers', () => {
  it("shows the instance's layers to its colour draw in a render with probes, and the default after it", async () => {
    const { renderer } = await testRenderer();
    shownProbes[0] = 1;
    const mesh = surfacesMesh();
    setVisualLayers(mesh, 4);
    const args = [
      renderer,
      null,
      camera,
      mesh.geometry,
      (mesh.material as THREE.Material[])[OPAQUE],
      mesh.geometry.groups[OPAQUE],
    ] as unknown as Parameters<THREE.Object3D['onBeforeRender']>;

    mesh.onBeforeRender(...args);
    const shown = instanceLayers[0];
    mesh.onAfterRender(...args);
    shownProbes[0] = 0;

    expect([shown, instanceLayers[0]]).toEqual([4, 1]);
  });
});
