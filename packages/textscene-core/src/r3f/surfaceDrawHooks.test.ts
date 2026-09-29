import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { surfaceDrawHooks } from './surfaceDrawHooks';
import { shadowCastingEffects } from './shadowCasting';
import { ShadowCastingSetting } from '../resources/meshlibrary/types';
import { buildStandardMaterial } from '../resources/materials/standardmaterial3d/build';
import { parseStandardMaterial3DScalars } from '../resources/materials/standardmaterial3d/scalars';
import {
  cameraLookingAt,
  drawColourGroup,
  drawShadowGroup,
  rotationAngle,
  writesAnything,
} from './testing/threePasses';

function material(properties: Record<string, string> = {}): THREE.Material {
  return buildStandardMaterial(parseStandardMaterial3DScalars(properties));
}

const OPAQUE = 0;
const ADDITIVE = 1;
const BILLBOARD = 2;
const PARTICLE_BILLBOARD = 3;

/**
 * One draw group per surface kind, each with its own material, and a yawed,
 * offset pose, so a billboard that leaks into another group shows.
 */
function surfacesMesh(castShadow: number | undefined = ShadowCastingSetting.ON): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  for (let i = 0; i < 4; i++) geometry.addGroup(i * 6, 6, i);
  const mesh = new THREE.Mesh(geometry, [
    material(),
    material({ transparency: '1', blend_mode: '1' }),
    material({ billboard_mode: '1' }),
    material({ billboard_mode: '3' }),
  ]);
  const hooks = surfaceDrawHooks(shadowCastingEffects(castShadow));
  Object.assign(mesh, hooks);
  mesh.position.set(5, 6, 7);
  mesh.rotation.set(0, Math.PI / 2, 0);
  mesh.updateMatrixWorld(true);
  return mesh;
}

const camera = cameraLookingAt({ x: 4, y: 3, z: 12 });
const shadowCamera = cameraLookingAt({ x: -8, y: 20, z: 1 });

function expectSameRotation(actual: THREE.Matrix4, expected: THREE.Matrix4) {
  expect(rotationAngle(actual, expected)).toBeCloseTo(0, 5);
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

describe('surfaceDrawHooks — shadow pass blend exclusion', () => {
  it('draws nothing into the shadow map for a blended group', () => {
    const mesh = surfacesMesh();
    expect(drawShadowGroup(mesh, camera, shadowCamera, ADDITIVE, (s) => writesAnything(s.depthMaterial!))).toBe(false);
  });

  it('draws an opaque group of the same mesh', () => {
    const mesh = surfacesMesh();
    expect(drawShadowGroup(mesh, camera, shadowCamera, OPAQUE, (s) => writesAnything(s.depthMaterial!))).toBe(true);
  });

  it('hands three its shared depth material back writable', () => {
    const mesh = surfacesMesh();
    const depth = drawShadowGroup(mesh, camera, shadowCamera, ADDITIVE, (s) => s.depthMaterial!);
    expect(depth.colorWrite).toBe(true);
    expect(depth.depthWrite).toBe(true);
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
    expect(drawColourGroup(mesh, camera, OPAQUE, (s) => writesAnything(s.material))).toBe(false);
  });

  it('SHADOWS_ONLY hands the shared surface material back unchanged', () => {
    const mesh = surfacesMesh(ShadowCastingSetting.SHADOWS_ONLY);
    const drawn = drawColourGroup(mesh, camera, OPAQUE, (s) => s.material);
    expect(drawn.colorWrite).toBe(true);
    expect(drawn.depthWrite).toBe(true);
  });

  it('SHADOWS_ONLY still casts from an opaque group', () => {
    const mesh = surfacesMesh(ShadowCastingSetting.SHADOWS_ONLY);
    expect(drawShadowGroup(mesh, camera, shadowCamera, OPAQUE, (s) => writesAnything(s.depthMaterial!))).toBe(true);
  });

  it('ON draws the colour pass', () => {
    const mesh = surfacesMesh(ShadowCastingSetting.ON);
    expect(drawColourGroup(mesh, camera, OPAQUE, (s) => writesAnything(s.material))).toBe(true);
  });
});

describe('surfaceDrawHooks — identity', () => {
  it('returns the same hooks for the same cast_shadow, so a mesh prop never churns', () => {
    const effects = shadowCastingEffects(ShadowCastingSetting.ON);
    expect(surfaceDrawHooks(effects)).toBe(surfaceDrawHooks(effects));
  });
});
