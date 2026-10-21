/**
 * The points of a GridMap item at each of its cells as one geometry, since three has no instanced
 * form of `THREE.Points`. Each cell's matrix moves its points and turns their normals.
 */

import * as THREE from 'three';

type TypedArrayConstructor = new (length: number) => THREE.TypedArray;

/**
 * `source` once for each of `matrices`, in order. Every attribute repeats, placed by its cell's
 * matrix as three places a geometry (`BufferGeometry.applyMatrix4`). Each draw group becomes one
 * range over every cell, so a surface costs one draw call however many cells hold it.
 */
export function pointsAtCells(
  source: THREE.BufferGeometry,
  matrices: readonly THREE.Matrix4[]
): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  merged.userData = { ...source.userData };
  const attributes = Object.keys(source.attributes);
  const placed = new Map(attributes.map((name) => [name, repeatedArray(source, name, matrices.length)]));
  matrices.forEach((matrix, cell) => {
    const cellGeometry = source.clone().applyMatrix4(matrix);
    for (const [name, array] of placed) {
      array.set(cellGeometry.getAttribute(name).array, cell * source.getAttribute(name).array.length);
    }
  });
  for (const name of attributes) {
    const { itemSize, normalized } = source.getAttribute(name);
    merged.setAttribute(name, new THREE.BufferAttribute(placed.get(name)!, itemSize, normalized));
  }
  merged.setIndex(new THREE.BufferAttribute(cellsIndex(source, matrices.length), 1));
  addGroupRanges(merged, source, matrices.length);
  return merged;
}

/** An empty array of `source`'s attribute `name`, long enough for `cells` copies. */
function repeatedArray(source: THREE.BufferGeometry, name: string, cells: number): THREE.TypedArray {
  const { array } = source.getAttribute(name);
  return new (array.constructor as TypedArrayConstructor)(array.length * cells);
}

/** The ranges `source` draws: each group, or the whole geometry when it has none. */
function drawRanges(source: THREE.BufferGeometry): readonly { start: number; count: number }[] {
  if (source.groups.length) return source.groups;
  return [{ start: 0, count: source.index ? source.index.count : source.getAttribute('position').count }];
}

/** Each range of `source` in turn, with every cell's vertices of it in cell order. */
function cellsIndex(source: THREE.BufferGeometry, cells: number): Uint32Array {
  const ranges = drawRanges(source);
  const vertexCount = source.getAttribute('position').count;
  const rangeLength = ranges.reduce((sum, { count }) => sum + count, 0);
  const index = new Uint32Array(rangeLength * cells);
  let written = 0;
  for (const { start, count } of ranges) {
    for (let cell = 0; cell < cells; cell++) {
      for (let i = start; i < start + count; i++) {
        index[written++] = (source.index ? source.index.getX(i) : i) + cell * vertexCount;
      }
    }
  }
  return index;
}

/** One group for each group of `source`, over the range `cellsIndex` gives it. */
function addGroupRanges(merged: THREE.BufferGeometry, source: THREE.BufferGeometry, cells: number): void {
  let start = 0;
  for (const group of source.groups) {
    merged.addGroup(start, group.count * cells, group.materialIndex);
    start += group.count * cells;
  }
}
