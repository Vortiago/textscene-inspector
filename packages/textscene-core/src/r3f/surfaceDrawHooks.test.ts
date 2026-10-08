import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyShadowCasting, rangedShadowCastingEffects, shadowCastingEffects } from './shadowCasting';
import { GODOT_ALPHA_HASH } from './materials/godotAlphaHash';
import type { ProgramShader } from './materialProgramInputs';
import { drawsAsOneBatch } from './surfaceDrawHooks';
import { billboardOf } from '../resources/materials/standardmaterial3d/materialBag';
import { ShadowCastingSetting } from '../godot/rendering';
import { SHADOW_PASS_OPAQUE_THRESHOLD } from '../godot/opaquePrepass';
import { standardMaterial as material } from '../resources/materials/standardmaterial3d/testing/standardMaterial';
import {
  castsFrom,
  drawColourGroup,
  drawsColour,
  drawShadowGroup,
  expectSameRotation,
  TEST_CAMERA as camera,
  TEST_SHADOW_CAMERA as shadowCamera,
} from './testing/threePasses';

const OPAQUE = 0;
const ADDITIVE = 1;
const BILLBOARD = 2;
const PARTICLE_BILLBOARD = 3;
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
  it('draws a billboarding group with the camera basis', () => {
    const mesh = surfacesMesh();
    const drawn = drawColourGroup(mesh, camera, BILLBOARD, (s) => s.matrixWorld);
    expectSameRotation(drawn, camera.matrixWorld);
    expect(new THREE.Vector3().setFromMatrixPosition(drawn)).toEqual(new THREE.Vector3(5, 6, 7));
  });

  it('restores the object pose after the draw', () => {
    const mesh = surfacesMesh();
    const before = mesh.matrixWorld.clone();
    drawColourGroup(mesh, camera, BILLBOARD, () => undefined);
    expect(mesh.matrixWorld.equals(before)).toBe(true);
  });

  it('leaves the model-view three computed for the draw, not a stale one from before it', () => {
    // three recomputes `modelViewMatrix` after the before-hook (`WebGLRenderer.js:2160`)
    // and `normalMatrix` from it, so the pair must stay as the draw left them.
    const mesh = surfacesMesh();
    mesh.modelViewMatrix.makeScale(9, 9, 9);
    const drawn = drawColourGroup(mesh, camera, BILLBOARD, (s) => s.modelViewMatrix);
    expect(mesh.modelViewMatrix.equals(drawn)).toBe(true);
  });

  it('leaves a group whose material does not billboard in the object pose', () => {
    const mesh = surfacesMesh();
    const drawn = drawColourGroup(mesh, camera, OPAQUE, (s) => s.matrixWorld);
    expect(drawn.equals(mesh.matrixWorld)).toBe(true);
  });
});

describe('surfaceDrawHooks — shadow pass billboard', () => {
  it('faces the main camera, not the light, as MAIN_CAM_INV_VIEW_MATRIX does', () => {
    const mesh = surfacesMesh();
    const drawn = drawShadowGroup(mesh, camera, shadowCamera, BILLBOARD, (s) => s);
    expectSameRotation(drawn.matrixWorld, camera.matrixWorld);
    const expectedModelView = new THREE.Matrix4().multiplyMatrices(
      shadowCamera.matrixWorldInverse,
      drawn.matrixWorld
    );
    expect(drawn.modelViewMatrix.equals(expectedModelView)).toBe(true);
  });

  it('faces the pass camera for BILLBOARD_PARTICLES, which reads INV_VIEW_MATRIX', () => {
    const mesh = surfacesMesh();
    const drawn = drawShadowGroup(mesh, camera, shadowCamera, PARTICLE_BILLBOARD, (s) => s.matrixWorld);
    expectSameRotation(drawn, shadowCamera.matrixWorld);
  });

  it('restores the pose and the model-view matrix after the draw', () => {
    const mesh = surfacesMesh();
    const pose = mesh.matrixWorld.clone();
    drawShadowGroup(mesh, camera, shadowCamera, BILLBOARD, () => undefined);
    expect(mesh.matrixWorld.equals(pose)).toBe(true);
    const objectModelView = new THREE.Matrix4().multiplyMatrices(shadowCamera.matrixWorldInverse, pose);
    expect(mesh.modelViewMatrix.equals(objectModelView)).toBe(true);
  });
});

/** The object-space uniform of `material` once it compiles Godot's hash. */
function hashObjectSpace(material: THREE.Material): THREE.Matrix4 {
  const shader: ProgramShader = { ...THREE.ShaderLib.standard, uniforms: {} };
  GODOT_ALPHA_HASH.onBeforeCompile.call(material, shader);
  return shader.uniforms.godotObjectFromModel!.value as THREE.Matrix4;
}

function groupMaterial(mesh: THREE.Mesh, group: number): THREE.Material {
  return (mesh.material as THREE.Material[])[group]!;
}

function expectSameMatrix(actual: THREE.Matrix4, expected: THREE.Matrix4): void {
  actual.elements.forEach((element, i) => expect(element).toBeCloseTo(expected.elements[i]!, 9));
}

describe('surfaceDrawHooks — alpha hash object space', () => {
  it('hashes a billboarding group in the object space of its unposed node', () => {
    const mesh = surfacesMesh();
    const objectSpace = hashObjectSpace(groupMaterial(mesh, BILLBOARD));
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
    const objectSpace = hashObjectSpace(groupMaterial(mesh, OPAQUE));
    drawColourGroup(mesh, camera, OPAQUE, () => undefined);
    expectSameMatrix(objectSpace, node.clone().invert().multiply(mesh.matrixWorld));
  });

  it('hashes a group three draws in the node pose in its own vertex space (edge case)', () => {
    const mesh = surfacesMesh();
    const objectSpace = hashObjectSpace(groupMaterial(mesh, OPAQUE));
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

describe('drawsAsOneBatch', () => {
  it('batches a surface that does not billboard', () => {
    expect(drawsAsOneBatch(billboardOf(material({})))).toBe(true);
  });

  it('refuses a surface that billboards, which must turn about each instance', () => {
    expect(drawsAsOneBatch(billboardOf(material({ billboard_mode: '2' })))).toBe(false);
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
