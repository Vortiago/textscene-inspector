/**
 * three's per-group draw hooks, replayed without a GL context: the colour pass as
 * `WebGLRenderer.renderObject` runs it (`WebGLRenderer.js:2158-2183`) and the shadow pass
 * as `WebGLShadowMap.renderObject` does (`WebGLShadowMap.js:526-560`). The GL draw becomes
 * a probe, which reads the state three would use at that instant.
 */

import * as THREE from 'three';
import { expect } from 'vitest';
import { drawnMaterial } from '../surfaceDrawHooks';

/** What a probe sees between a draw's before-hook and its after-hook. */
export interface DrawState {
  /** The group's own material: the colour pass draws it, the shadow pass reads it. */
  material: THREE.Material;
  /** The depth material of a shadow draw; absent in the colour pass. */
  depthMaterial?: THREE.MeshDepthMaterial;
  /** `object.matrixWorld` as three uploads it as `modelMatrix`. */
  matrixWorld: THREE.Matrix4;
  /** `object.modelViewMatrix` as three uploads it. */
  modelViewMatrix: THREE.Matrix4;
  /** Whether the draw leaves a mark: elements to draw, into a buffer it writes. */
  draws: boolean;
}

/** The group three draws at `groupIndex`, or null for a single-material mesh. */
function groupAt(mesh: THREE.Mesh, groupIndex: number): THREE.Group | null {
  if (!Array.isArray(mesh.material)) return null;
  return mesh.geometry.groups[groupIndex] as unknown as THREE.Group;
}

function snapshot(mesh: THREE.Mesh, material: THREE.Material, drawn: THREE.Material): DrawState {
  return {
    material,
    matrixWorld: mesh.matrixWorld.clone(),
    modelViewMatrix: mesh.modelViewMatrix.clone(),
    draws: mesh.geometry.drawRange.count > 0 && (drawn.colorWrite || drawn.depthWrite),
  };
}

/** One colour-pass draw of the mesh's group at `groupIndex` (0 for a single material). */
export function drawColourGroup<T>(
  mesh: THREE.Mesh,
  camera: THREE.Camera,
  groupIndex: number,
  probe: (state: DrawState) => T
): T {
  const group = groupAt(mesh, groupIndex);
  const material = drawnMaterial(mesh, group)!;
  const args = [null, null, camera, mesh.geometry, material, group] as unknown as Parameters<
    THREE.Object3D['onBeforeRender']
  >;
  mesh.onBeforeRender(...args);
  mesh.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld);
  const seen = probe(snapshot(mesh, material, material));
  mesh.onAfterRender(...args);
  return seen;
}

/** `WebGLShadowMap.js:51`: the depth material's acne-mitigating side flip. */
const SHADOW_SIDE: Record<number, THREE.Side> = {
  [THREE.FrontSide]: THREE.BackSide,
  [THREE.BackSide]: THREE.FrontSide,
  [THREE.DoubleSide]: THREE.DoubleSide,
};

/**
 * One shadow-pass draw. three sets `modelViewMatrix` once per object before its group loop
 * (`WebGLShadowMap.js:528`), and hands each hook the object, the main camera and the light's.
 */
export function drawShadowGroup<T>(
  mesh: THREE.Mesh,
  camera: THREE.Camera,
  shadowCamera: THREE.Camera,
  groupIndex: number,
  probe: (state: DrawState) => T
): T {
  const group = groupAt(mesh, groupIndex);
  const material = drawnMaterial(mesh, group)!;
  mesh.modelViewMatrix.multiplyMatrices(shadowCamera.matrixWorldInverse, mesh.matrixWorld);
  const depthMaterial = new THREE.MeshDepthMaterial();
  depthMaterial.side = material.shadowSide ?? SHADOW_SIDE[material.side as number]!;
  const args = [null, mesh, camera, shadowCamera, mesh.geometry, depthMaterial, group] as unknown as Parameters<
    THREE.Object3D['onBeforeShadow']
  >;
  mesh.onBeforeShadow(...args);
  const seen = probe({ ...snapshot(mesh, material, depthMaterial), depthMaterial });
  mesh.onAfterShadow(...args);
  return seen;
}

/** A camera at `position` looking at `target`, with its world matrices current. */
export function cameraLookingAt(
  position: THREE.Vector3Like,
  target: THREE.Vector3Like = { x: 0, y: 0, z: 0 }
): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(position.x, position.y, position.z);
  camera.lookAt(target.x, target.y, target.z);
  camera.updateMatrixWorld(true);
  return camera;
}

/**
 * An off-axis main camera and a light camera that differ from it, so a probe can tell
 * whether a shadow draw faced the viewer or the light.
 */
export const TEST_CAMERA = cameraLookingAt({ x: 4, y: 3, z: 12 });
export const TEST_SHADOW_CAMERA = cameraLookingAt({ x: -8, y: 20, z: 1 });

/** Whether the mesh's group casts: `castShadow` on, and its shadow draw leaves a mark. */
export function castsFrom(mesh: THREE.Mesh, groupIndex = 0): boolean {
  if (!mesh.castShadow) return false;
  return drawShadowGroup(mesh, TEST_CAMERA, TEST_SHADOW_CAMERA, groupIndex, (s) => s.draws);
}

/** Whether the mesh's group leaves a mark in the colour pass. */
export function drawsColour(mesh: THREE.Mesh, groupIndex = 0): boolean {
  return drawColourGroup(mesh, TEST_CAMERA, groupIndex, (s) => s.draws);
}

/** The side three's depth material takes for the mesh's first draw group, after its hooks. */
export function depthSideOf(mesh: THREE.Mesh): THREE.Side {
  return drawShadowGroup(mesh, TEST_CAMERA, TEST_SHADOW_CAMERA, 0, (s) => s.depthMaterial!.side);
}

/** The angle in radians between the rotations of two world matrices, their scale set aside. */
export function rotationAngle(a: THREE.Matrix4, b: THREE.Matrix4): number {
  return rotationOf(a).angleTo(rotationOf(b));
}

/** Two world matrices turn the same way, to five decimal places of a radian. */
export function expectSameRotation(actual: THREE.Matrix4, expected: THREE.Matrix4): void {
  expect(rotationAngle(actual, expected)).toBeCloseTo(0, 5);
}

function rotationOf(matrix: THREE.Matrix4): THREE.Quaternion {
  const rotation = new THREE.Quaternion();
  matrix.decompose(new THREE.Vector3(), rotation, new THREE.Vector3());
  return rotation;
}
