/**
 * The points of a GridMap item at each of its cells as one geometry, since three has no instanced
 * form of `THREE.Points`. Each cell's matrix moves its points and turns their normals. For a program
 * that reads the item's space, as Godot's instanced draw does, each point also keeps its item's
 * position and normal and its cell's matrix.
 */

import * as THREE from 'three';
import { CELL_POINT_ATTRIBUTES, type PointPlacement } from '../../../r3f/materials/godotPoint';
import { geometryDrawsPoints } from '../../../resources/meshes/godotSurface';

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

/**
 * `pointsAtCells`, with each point's item position and normal, unplaced, and its cell's matrix. They
 * cost a mat4 per point, so only a surface that reads the item's space draws this geometry.
 */
export function pointsAtCellsInItemSpace(
  source: THREE.BufferGeometry,
  matrices: readonly THREE.Matrix4[]
): THREE.BufferGeometry {
  const merged = pointsAtCells(source, matrices);
  const { itemPosition, itemNormal, cellMatrix } = CELL_POINT_ATTRIBUTES;
  merged.setAttribute(itemPosition, repeatedAttribute(source, 'position', matrices.length));
  merged.setAttribute(itemNormal, repeatedAttribute(source, 'normal', matrices.length));
  merged.setAttribute(cellMatrix, cellMatrices(source.getAttribute('position').count, matrices));
  return merged;
}

/** Where `geometry`'s points sit: merged at cells by `pointsAtCellsInItemSpace`, or in the mesh. Undefined for triangles. */
export function pointPlacementOf(geometry: THREE.BufferGeometry): PointPlacement | undefined {
  if (!geometryDrawsPoints(geometry)) return undefined;
  return geometry.getAttribute(CELL_POINT_ATTRIBUTES.cellMatrix) ? 'cells' : 'mesh';
}

/** `source`'s attribute `name` once for each of `cells`, as it stands. */
function repeatedAttribute(source: THREE.BufferGeometry, name: string, cells: number): THREE.BufferAttribute {
  const { array, itemSize, normalized } = source.getAttribute(name);
  const repeated = repeatedArray(source, name, cells);
  for (let cell = 0; cell < cells; cell++) repeated.set(array, cell * array.length);
  return new THREE.BufferAttribute(repeated, itemSize, normalized);
}

/** Each of `matrices` once for each of a cell's `pointCount` points. */
function cellMatrices(pointCount: number, matrices: readonly THREE.Matrix4[]): THREE.BufferAttribute {
  const elements = new Float32Array(pointCount * matrices.length * 16);
  matrices.forEach((matrix, cell) => {
    for (let point = 0; point < pointCount; point++) {
      elements.set(matrix.elements, (cell * pointCount + point) * 16);
    }
  });
  return new THREE.BufferAttribute(elements, 16);
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
