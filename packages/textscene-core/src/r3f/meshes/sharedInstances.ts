/**
 * A mesh drawn once at each of several places, as Godot draws a MultiMesh. three draws any object
 * over an InstancedBufferGeometry instanced (r187 `WebGLRenderer.js:1345-1350`), `THREE.Points` too, and
 * binds its `instanceMatrix` attribute (`WebGLBindingStates.js:169`). A points program declares it.
 */

import { useLayoutEffect } from 'react';
import * as THREE from 'three';
import type { ListedPlacement, ListedSurface } from '../materials/godotPoint';
import { geometryPrimitive, type SurfacePrimitive } from '../../resources/meshes/godotSurface';

/** The attribute that holds each place's matrix, the name three's instanced programs read. */
export const INSTANCE_MATRIX_ATTRIBUTE = 'instanceMatrix';

/** The attribute that holds each place's custom data, Godot's `INSTANCE_CUSTOM`. */
export const INSTANCE_CUSTOM_ATTRIBUTE = 'instanceCustom';

/** The floats of one place's matrix. */
const MATRIX_FLOATS = 16;

/**
 * `source` for `count` places, whose matrices are zero until a caller writes them. It shares
 * the source's attributes, index and groups, which `useSharedInstances` leaves to their owner.
 *
 * @canonical Instanced geometry over a shared source
 */
export function sharedInstances(source: THREE.BufferGeometry, count: number): THREE.InstancedBufferGeometry {
  const geometry = new THREE.InstancedBufferGeometry();
  share(geometry, source);
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

/** Gives `geometry` the attributes and index of `source`, which it draws but does not own. */
function share(geometry: THREE.BufferGeometry, source: THREE.BufferGeometry): void {
  for (const [name, attribute] of Object.entries(source.attributes)) geometry.setAttribute(name, attribute);
  geometry.setIndex(source.index);
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
 * of a disposed geometry (r187 `WebGLGeometries.js:10-44`), and the source's draws would read freed buffers.
 */
function releaseSharedInstances(geometry: THREE.BufferGeometry, source: THREE.BufferGeometry): void {
  for (const name of Object.keys(source.attributes)) geometry.deleteAttribute(name);
  geometry.setIndex(null);
  geometry.dispose();
}

/**
 * Holds `geometry`'s share of `source` while the caller is mounted, and releases it on unmount. A
 * remount, as StrictMode runs one, shares the same geometry again.
 */
export function useSharedInstances(geometry: THREE.BufferGeometry, source: THREE.BufferGeometry): void {
  useLayoutEffect(() => {
    share(geometry, source);
    return () => releaseSharedInstances(geometry, source);
  }, [geometry, source]);
}

/** The `SurfaceMaterialSlot` props that say where a surface of `primitive` sits. None for triangles. */
export function listedSlot(
  primitive: SurfacePrimitive,
  placement: ListedPlacement
): { listed?: ListedSurface } {
  return primitive === 'triangles' ? {} : { listed: { primitive, placement } };
}

/** The slot props for `geometry`'s points or lines, at instances when `sharedInstances` built it. */
export function listedSlotOf(geometry: THREE.BufferGeometry): { listed?: ListedSurface } {
  const isInstanced = (geometry as THREE.InstancedBufferGeometry).isInstancedBufferGeometry;
  return listedSlot(geometryPrimitive(geometry), isInstanced ? 'instances' : 'mesh');
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

/**
 * Scratch for `raycastInstanced`, the only writer, built on first use and overwritten by every call.
 * Each holds `NO_GEOMETRY` between calls, so a released draw's instance buffers are not kept alive.
 */
const NO_GEOMETRY = new THREE.BufferGeometry();
let pointsScratch: THREE.Points | undefined;
let linesScratch: THREE.LineSegments | undefined;
const instanceLocal = new THREE.Matrix4();
const instanceWorld = new THREE.Matrix4();
const instanceHits: THREE.Intersection[] = [];

/**
 * `THREE.Points.raycast` or `THREE.LineSegments.raycast` at each instance, as `InstancedMesh.raycast`
 * tests each of its own: their own raycast reads the source positions alone.
 */
export function raycastInstanced(
  this: THREE.Points | THREE.LineSegments,
  raycaster: THREE.Raycaster,
  intersects: THREE.Intersection[]
): void {
  const geometry = this.geometry as THREE.InstancedBufferGeometry;
  const matrices = instanceMatrices(geometry);
  // Neither raycast reads a material, so the scratch takes only the geometry.
  const scratch = (this as THREE.Points).isPoints
    ? (pointsScratch ??= new THREE.Points(NO_GEOMETRY))
    : (linesScratch ??= new THREE.LineSegments(NO_GEOMETRY));
  scratch.geometry = geometry;
  for (let instanceId = 0; instanceId < geometry.instanceCount; instanceId++) {
    instanceLocal.fromArray(matrices.array, instanceId * MATRIX_FLOATS);
    scratch.matrixWorld = instanceWorld.multiplyMatrices(this.matrixWorld, instanceLocal);
    scratch.raycast(raycaster, instanceHits);
    for (const hit of instanceHits) intersects.push({ ...hit, instanceId, object: this });
    instanceHits.length = 0;
  }
  scratch.geometry = NO_GEOMETRY;
}
