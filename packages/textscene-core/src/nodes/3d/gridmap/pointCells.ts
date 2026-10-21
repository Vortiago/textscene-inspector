/**
 * The points of a GridMap item at each of its cells as one geometry, since three has no instanced
 * form of `THREE.Points`. Each cell's matrix moves its points and turns their normals.
 */

import * as THREE from 'three';

/** Written only by `pointsAtCells`. `Matrix3.getNormalMatrix` fills it, so a large grid allocates none. */
const normalMatrix = new THREE.Matrix3();

/**
 * `source` once for each of `matrices`, in order. Every attribute and every draw group repeats. A
 * position moves with its cell's matrix, and a normal turns with its normal matrix, normalised as
 * three's lit programs do per point.
 */
export function pointsAtCells(
  source: THREE.BufferGeometry,
  matrices: readonly THREE.Matrix4[]
): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  merged.userData = source.userData;
  for (const [name, attribute] of Object.entries(source.attributes)) {
    merged.setAttribute(name, repeatedAttribute(name, attribute as THREE.BufferAttribute, matrices));
  }
  const vertexCount = source.getAttribute('position')!.count;
  const drawCount = source.index ? source.index.count : vertexCount;
  if (source.index) merged.setIndex(repeatedIndex(source.index, matrices.length, vertexCount));
  matrices.forEach((_, cell) => {
    for (const group of source.groups) {
      merged.addGroup(cell * drawCount + group.start, group.count, group.materialIndex);
    }
  });
  return merged;
}

function repeatedAttribute(
  name: string,
  source: THREE.BufferAttribute,
  matrices: readonly THREE.Matrix4[]
): THREE.BufferAttribute {
  const stride = source.count * source.itemSize;
  const array = new (source.array.constructor as new (length: number) => THREE.TypedArray)(
    stride * matrices.length
  );
  const merged = new THREE.BufferAttribute(array, source.itemSize, source.normalized);
  matrices.forEach((matrix, cell) => {
    const cellStart = cell * source.count;
    for (let i = 0; i < source.count; i++) merged.copyAt(cellStart + i, source, i);
    if (name === 'position') transformRange(merged, cellStart, source.count, (v) => v.applyMatrix4(matrix));
    if (name === 'normal') {
      normalMatrix.getNormalMatrix(matrix);
      transformRange(merged, cellStart, source.count, (v) => v.applyNormalMatrix(normalMatrix).normalize());
    }
  });
  return merged;
}

/** Rewrites `count` vectors of `attribute` from `start` through `transform`. */
function transformRange(
  attribute: THREE.BufferAttribute,
  start: number,
  count: number,
  transform: (vector: THREE.Vector3) => THREE.Vector3
): void {
  const vector = new THREE.Vector3();
  for (let i = start; i < start + count; i++) {
    attribute.setXYZ(i, ...transform(vector.fromBufferAttribute(attribute, i)).toArray());
  }
}

function repeatedIndex(
  source: THREE.BufferAttribute,
  cells: number,
  vertexCount: number
): THREE.BufferAttribute {
  const array = new Uint32Array(source.count * cells);
  for (let cell = 0; cell < cells; cell++) {
    for (let i = 0; i < source.count; i++)
      array[cell * source.count + i] = source.getX(i) + cell * vertexCount;
  }
  return new THREE.BufferAttribute(array, 1);
}
