/**
 * three's per-group draw hooks, replayed without a GL context: the colour pass as
 * `WebGLRenderer.renderObject` runs it (`WebGLRenderer.js:2158-2183`) and the shadow pass
 * as `WebGLShadowMap.renderObject` does (`WebGLShadowMap.js:518-570`). The GL draw becomes
 * a probe, which reads the state three would use at that instant.
 */

import * as THREE from 'three';
import { expect } from 'vitest';
import { drawnMaterial } from '../surfaceDrawHooks';

/** What a probe sees between a draw's before-hook and its after-hook. */
export interface DrawState {
  /** The group's own material: the colour pass draws it, the shadow pass reads it. */
  material: THREE.Material;
  /** The depth or distance material three hands a shadow draw; absent in the colour pass. */
  depthMaterial?: THREE.MeshDepthMaterial | THREE.MeshDistanceMaterial;
  /** The depth material the shadow draw draws with: the hooks' own, or three's. */
  castMaterial?: THREE.Material;
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

/** A draw the hooks make themselves, through the renderer three hands them. */
interface OwnDraw {
  material: THREE.Material;
  elements: number;
}

/** The renderer a shadow hook draws its own depth material through, recording each draw. */
function recordingRenderer(draws: OwnDraw[]): THREE.WebGLRenderer {
  const state = new WeakMap<object, Record<string, unknown>>();
  return {
    renderBufferDirect(
      _camera: THREE.Camera,
      _scene: THREE.Scene,
      geometry: THREE.BufferGeometry,
      material: THREE.Material
    ) {
      draws.push({ material, elements: geometry.drawRange.count });
    },
    properties: {
      get(object: object) {
        if (!state.has(object)) state.set(object, {});
        return state.get(object);
      },
    },
  } as unknown as THREE.WebGLRenderer;
}

/** What the shadow draw leaves, whether the hooks drew it or three does. */
function shadowState(
  mesh: THREE.Mesh,
  material: THREE.Material,
  depthMaterial: THREE.MeshDepthMaterial | THREE.MeshDistanceMaterial,
  ownDraws: readonly OwnDraw[]
): DrawState {
  const own = ownDraws[0];
  if (!own) return { ...snapshot(mesh, material, depthMaterial), depthMaterial, castMaterial: depthMaterial };
  const draws = own.elements > 0 && (own.material.colorWrite || own.material.depthWrite);
  return { ...snapshot(mesh, material, own.material), depthMaterial, castMaterial: own.material, draws };
}

/**
 * One shadow-pass draw. three sets `modelViewMatrix` once per object before its group loop
 * (`WebGLShadowMap.js:528`), and hands each hook the renderer, the object, the main camera and
 * the light's.
 */
export function drawShadowGroup<T>(
  mesh: THREE.Mesh,
  camera: THREE.Camera,
  shadowCamera: THREE.Camera,
  groupIndex: number,
  probe: (state: DrawState) => T
): T {
  return drawShadowWith(new THREE.MeshDepthMaterial(), mesh, camera, shadowCamera, groupIndex, probe);
}

/** One shadow-pass draw, with the depth or distance material three hands a sun or an omni light. */
function drawShadowWith<T>(
  depthMaterial: THREE.MeshDepthMaterial | THREE.MeshDistanceMaterial,
  mesh: THREE.Mesh,
  camera: THREE.Camera,
  shadowCamera: THREE.Camera,
  groupIndex: number,
  probe: (state: DrawState) => T
): T {
  const group = groupAt(mesh, groupIndex);
  const material = drawnMaterial(mesh, group)!;
  mesh.modelViewMatrix.multiplyMatrices(shadowCamera.matrixWorldInverse, mesh.matrixWorld);
  depthMaterial.side = material.shadowSide ?? SHADOW_SIDE[material.side as number]!;
  const ownDraws: OwnDraw[] = [];
  const args = [
    recordingRenderer(ownDraws),
    mesh,
    camera,
    shadowCamera,
    mesh.geometry,
    depthMaterial,
    group,
  ] as unknown as Parameters<THREE.Object3D['onBeforeShadow']>;
  mesh.onBeforeShadow(...args);
  const seen = probe(shadowState(mesh, material, depthMaterial, ownDraws));
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

/** A sun's light camera: three gives a DirectionalLight's shadow an orthographic one. */
export const TEST_SUN_SHADOW_CAMERA = (() => {
  const camera = new THREE.OrthographicCamera();
  camera.position.set(-8, 20, 1);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  return camera;
})();

/** Whether the mesh's group casts from an omni or spot light: `castShadow` on, and its shadow draw leaves a mark. */
export function castsFrom(mesh: THREE.Mesh, groupIndex = 0): boolean {
  if (!mesh.castShadow) return false;
  return drawShadowGroup(mesh, TEST_CAMERA, TEST_SHADOW_CAMERA, groupIndex, (s) => s.draws);
}

/** Whether the mesh's first group casts from a directional light. */
export function castsSunShadowFrom(mesh: THREE.Mesh): boolean {
  if (!mesh.castShadow) return false;
  return drawShadowGroup(mesh, TEST_CAMERA, TEST_SUN_SHADOW_CAMERA, 0, (s) => s.draws);
}

/** The materials the mesh's first group casts with into a sun's shadow and into an omni light's. */
export function castMaterialsOf(mesh: THREE.Mesh): [THREE.Material, THREE.Material] {
  const castMaterial = (s: DrawState) => s.castMaterial!;
  return [
    drawShadowWith(new THREE.MeshDepthMaterial(), mesh, TEST_CAMERA, TEST_SUN_SHADOW_CAMERA, 0, castMaterial),
    drawShadowWith(new THREE.MeshDistanceMaterial(), mesh, TEST_CAMERA, TEST_SHADOW_CAMERA, 0, castMaterial),
  ];
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
