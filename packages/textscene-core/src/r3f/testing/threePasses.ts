/**
 * three's per-group draw hooks, replayed without a GL context: the colour pass as
 * `WebGLRenderer.renderObject` runs it (`WebGLRenderer.js:2158-2183`) and the shadow
 * pass as `WebGLShadowMap.renderObject` does (`WebGLShadowMap.js:526-560`). The GL
 * draw becomes a probe, which reads the state three would upload at that instant.
 */

import * as THREE from 'three';
import { drawnMaterial } from '../shadowCasting';

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
}

/** The group three draws at `groupIndex`, or null for a single-material mesh. */
function groupAt(mesh: THREE.Mesh, groupIndex: number): THREE.Group | null {
  if (!Array.isArray(mesh.material)) return null;
  return mesh.geometry.groups[groupIndex] as unknown as THREE.Group;
}

/** The material three draws for that group, by the rule the shadow hooks read. */
function materialAt(mesh: THREE.Mesh, groupIndex: number): THREE.Material {
  return drawnMaterial(mesh, groupAt(mesh, groupIndex))!;
}

function snapshot(mesh: THREE.Mesh, material: THREE.Material): DrawState {
  return {
    material,
    matrixWorld: mesh.matrixWorld.clone(),
    modelViewMatrix: mesh.modelViewMatrix.clone(),
  };
}

/** One colour-pass draw of the mesh's group at `groupIndex` (0 for a single material). */
export function drawColourGroup<T>(
  mesh: THREE.Mesh,
  camera: THREE.Camera,
  groupIndex: number,
  probe: (state: DrawState) => T
): T {
  const material = materialAt(mesh, groupIndex);
  const group = groupAt(mesh, groupIndex);
  const scene = new THREE.Scene();
  mesh.onBeforeRender(null as never, scene, camera, mesh.geometry, material, group as never);
  mesh.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld);
  const seen = probe(snapshot(mesh, material));
  mesh.onAfterRender(null as never, scene, camera, mesh.geometry, material, group as never);
  return seen;
}

/** `WebGLShadowMap.js:51`: the depth material's acne-mitigating side flip. */
const SHADOW_SIDE: Record<number, THREE.Side> = {
  [THREE.FrontSide]: THREE.BackSide,
  [THREE.BackSide]: THREE.FrontSide,
  [THREE.DoubleSide]: THREE.DoubleSide,
};

/**
 * One shadow-pass draw. three sets `modelViewMatrix` once per object before its
 * group loop (`WebGLShadowMap.js:528`), and hands the main camera and the shadow
 * camera to each hook.
 */
export function drawShadowGroup<T>(
  mesh: THREE.Mesh,
  camera: THREE.Camera,
  shadowCamera: THREE.Camera,
  groupIndex: number,
  probe: (state: DrawState) => T
): T {
  const material = materialAt(mesh, groupIndex);
  const group = groupAt(mesh, groupIndex);
  mesh.modelViewMatrix.multiplyMatrices(shadowCamera.matrixWorldInverse, mesh.matrixWorld);
  const depthMaterial = new THREE.MeshDepthMaterial();
  depthMaterial.side = material.shadowSide ?? SHADOW_SIDE[material.side as number]!;
  mesh.onBeforeShadow(
    null as never, mesh as never, camera, shadowCamera, mesh.geometry, depthMaterial, group as never
  );
  const seen = probe({ ...snapshot(mesh, material), depthMaterial });
  mesh.onAfterShadow(
    null as never, mesh as never, camera, shadowCamera, mesh.geometry, depthMaterial, group as never
  );
  return seen;
}

/** Whether a draw with this material state leaves any mark in its target. */
export function writesAnything(material: THREE.Material): boolean {
  return material.colorWrite || material.depthWrite;
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

/** The angle in radians between the rotations of two world matrices, their scale set aside. */
export function rotationAngle(a: THREE.Matrix4, b: THREE.Matrix4): number {
  return rotationOf(a).angleTo(rotationOf(b));
}

function rotationOf(matrix: THREE.Matrix4): THREE.Quaternion {
  const rotation = new THREE.Quaternion();
  matrix.decompose(new THREE.Vector3(), rotation, new THREE.Vector3());
  return rotation;
}
