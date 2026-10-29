/**
 * A mesh drawn once at each of several places, as Godot draws a MultiMesh. three draws any object
 * over an InstancedBufferGeometry instanced (`WebGLRenderer.js:1341-1346`), `THREE.Points` too, and
 * binds its `instanceMatrix` attribute (`WebGLBindingStates.js:169`). A points program declares it.
 */

import * as THREE from 'three';
import type { PointPlacement } from '../materials/godotPoint';
import { geometryDrawsPoints } from '../../resources/meshes/godotSurface';

/** The attribute that holds each place's matrix, the name three's instanced programs read. */
export const INSTANCE_MATRIX_ATTRIBUTE = 'instanceMatrix';

/** The floats of one place's matrix. */
const MATRIX_FLOATS = 16;

/**
 * `source` for `count` places, whose matrices are zero until a caller writes them. It shares
 * the source's attributes, index and groups, which `releaseSharedInstances` leaves to their owner.
 *
 * @canonical Instanced geometry over a shared source
 */
export function sharedInstances(source: THREE.BufferGeometry, count: number): THREE.InstancedBufferGeometry {
  const geometry = new THREE.InstancedBufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) geometry.setAttribute(name, attribute);
  geometry.setIndex(source.index);
  for (const { start, count: groupCount, materialIndex } of source.groups) {
    geometry.addGroup(start, groupCount, materialIndex);
  }
  geometry.userData = { ...source.userData };
  geometry.instanceCount = count;
  geometry.setAttribute(
    INSTANCE_MATRIX_ATTRIBUTE,
    new THREE.InstancedBufferAttribute(new Float32Array(count * MATRIX_FLOATS), MATRIX_FLOATS)
  );
  return geometry;
}

/** `source` at each of `matrices`. */
export function sharedInstancesAt(
  source: THREE.BufferGeometry,
  matrices: readonly THREE.Matrix4[]
): THREE.InstancedBufferGeometry {
  const geometry = sharedInstances(source, matrices.length);
  const attribute = instanceMatrices(geometry);
  matrices.forEach((matrix, place) => writeInstanceMatrix(attribute, place, matrix));
  return geometry;
}

/** Writes `matrix` as instance `place`'s. The caller flags the attribute for upload once all are written. */
export function writeInstanceMatrix(
  matrices: THREE.InstancedBufferAttribute,
  place: number,
  matrix: THREE.Matrix4
): void {
  matrix.toArray(matrices.array, place * MATRIX_FLOATS);
}

/** The place matrices of a geometry `sharedInstances` built. */
export function instanceMatrices(geometry: THREE.BufferGeometry): THREE.InstancedBufferAttribute {
  return geometry.getAttribute(INSTANCE_MATRIX_ATTRIBUTE) as THREE.InstancedBufferAttribute;
}

/**
 * Disposes `geometry` without the attributes it shares with `source`. Three frees each attribute
 * of a disposed geometry (`WebGLGeometries.js:8-37`), and the source's draws would read freed buffers.
 */
export function releaseSharedInstances(geometry: THREE.BufferGeometry, source: THREE.BufferGeometry): void {
  for (const name of Object.keys(source.attributes)) geometry.deleteAttribute(name);
  geometry.setIndex(null);
  geometry.dispose();
}

/** Where `geometry`'s points sit: at instances, or in the mesh. Undefined for triangles. */
export function pointPlacementOf(geometry: THREE.BufferGeometry): PointPlacement | undefined {
  if (!geometryDrawsPoints(geometry)) return undefined;
  return (geometry as THREE.InstancedBufferGeometry).isInstancedBufferGeometry ? 'instances' : 'mesh';
}

/**
 * The box and sphere of every place of `source`. three culls by an object's own sphere
 * (`Frustum.js:148`), and the framing reads its own box (`bounds.ts`).
 */
export function instancesBounds(
  source: THREE.BufferGeometry,
  matrices: readonly THREE.Matrix4[]
): { boundingBox: THREE.Box3; boundingSphere: THREE.Sphere } {
  if (!source.boundingBox) source.computeBoundingBox();
  const boundingBox = new THREE.Box3();
  const placed = new THREE.Box3();
  for (const matrix of matrices) boundingBox.union(placed.copy(source.boundingBox!).applyMatrix4(matrix));
  return { boundingBox, boundingSphere: boundingBox.getBoundingSphere(new THREE.Sphere()) };
}

/** Scratch for `raycastInstancedPoints`, overwritten by every call. */
const instancePoints = new THREE.Points();
const instanceLocal = new THREE.Matrix4();
const instanceWorld = new THREE.Matrix4();
const instanceHits: THREE.Intersection[] = [];

/**
 * `THREE.Points.raycast` at each instance, as `InstancedMesh.raycast` tests each of its own: the
 * points' own raycast reads the source positions alone.
 */
export function raycastInstancedPoints(
  this: THREE.Points,
  raycaster: THREE.Raycaster,
  intersects: THREE.Intersection[]
): void {
  const geometry = this.geometry as THREE.InstancedBufferGeometry;
  const matrices = instanceMatrices(geometry);
  // `Points.raycast` reads no material, so the scratch takes only the geometry.
  instancePoints.geometry = geometry;
  for (let instanceId = 0; instanceId < geometry.instanceCount; instanceId++) {
    instanceLocal.fromArray(matrices.array, instanceId * MATRIX_FLOATS);
    instancePoints.matrixWorld = instanceWorld.multiplyMatrices(this.matrixWorld, instanceLocal);
    instancePoints.raycast(raycaster, instanceHits);
    for (const hit of instanceHits) intersects.push({ ...hit, instanceId, object: this });
    instanceHits.length = 0;
  }
}
