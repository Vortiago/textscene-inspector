/**
 * A points geometry at each of several places as one geometry, since three has no instanced form of
 * `THREE.Points`: a GridMap item at its cells, a particle emitter's mesh at its particles. Each
 * place's matrix moves its points and turns their normals. For a program that reads the item's
 * space, as Godot's instanced draw does, each point also keeps its item's position and normal and
 * its place's matrix.
 */

import * as THREE from 'three';
import { CELL_POINT_ATTRIBUTES, type PointPlacement } from '../materials/godotPoint';
import { geometryDrawsPoints } from '../../resources/meshes/godotSurface';

type TypedArrayConstructor = new (length: number) => THREE.TypedArray;

/**
 * `source` once for each of `matrices`, in order. Every attribute repeats, placed by its place's
 * matrix as three places a geometry (`BufferGeometry.applyMatrix4`). Each draw group becomes one
 * range over every place, so a surface costs one draw call however many places hold it.
 *
 * @canonical Points geometry repeated at many places
 */
export function pointsAtPlaces(
  source: THREE.BufferGeometry,
  matrices: readonly THREE.Matrix4[]
): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  merged.userData = { ...source.userData };
  const attributes = Object.keys(source.attributes);
  const placed = new Map(attributes.map((name) => [name, repeatedArray(source, name, matrices.length)]));
  const normalMatrix = new THREE.Matrix3();
  matrices.forEach((matrix, place) => {
    normalMatrix.getNormalMatrix(matrix);
    for (const [name, array] of placed) {
      const { array: own, itemSize } = source.getAttribute(name);
      const slice = array.subarray(place * own.length, (place + 1) * own.length);
      slice.set(own);
      placeAttribute(name, new THREE.BufferAttribute(slice, itemSize), matrix, normalMatrix);
    }
  });
  for (const name of attributes) {
    const { itemSize, normalized } = source.getAttribute(name);
    merged.setAttribute(name, new THREE.BufferAttribute(placed.get(name)!, itemSize, normalized));
  }
  merged.setIndex(new THREE.BufferAttribute(placesIndex(source, matrices.length), 1));
  addGroupRanges(merged, source, matrices.length);
  return merged;
}

/**
 * `pointsAtPlaces`, with each point's item position and normal, unplaced, and its place's matrix.
 * They cost a mat4 per point, so only a surface that reads the item's space draws this geometry.
 */
export function pointsAtPlacesInItemSpace(
  source: THREE.BufferGeometry,
  matrices: readonly THREE.Matrix4[]
): THREE.BufferGeometry {
  const merged = pointsAtPlaces(source, matrices);
  const { itemPosition, itemNormal, cellMatrix } = CELL_POINT_ATTRIBUTES;
  merged.setAttribute(itemPosition, repeatedAttribute(source, 'position', matrices.length));
  merged.setAttribute(itemNormal, repeatedAttribute(source, 'normal', matrices.length));
  merged.setAttribute(cellMatrix, placeMatrices(source.getAttribute('position').count, matrices));
  return merged;
}

/** Where `geometry`'s points sit: merged at places by `pointsAtPlacesInItemSpace`, or in the mesh. Undefined for triangles. */
export function pointPlacementOf(geometry: THREE.BufferGeometry): PointPlacement | undefined {
  if (!geometryDrawsPoints(geometry)) return undefined;
  return geometry.getAttribute(CELL_POINT_ATTRIBUTES.cellMatrix) ? 'cells' : 'mesh';
}

/** `source`'s attribute `name` once for each of `places`, as it stands. */
function repeatedAttribute(
  source: THREE.BufferGeometry,
  name: string,
  places: number
): THREE.BufferAttribute {
  const { array, itemSize, normalized } = source.getAttribute(name);
  const repeated = repeatedArray(source, name, places);
  for (let place = 0; place < places; place++) repeated.set(array, place * array.length);
  return new THREE.BufferAttribute(repeated, itemSize, normalized);
}

/** Each of `matrices` once for each of a place's `pointCount` points. */
function placeMatrices(pointCount: number, matrices: readonly THREE.Matrix4[]): THREE.BufferAttribute {
  const elements = new Float32Array(pointCount * matrices.length * 16);
  matrices.forEach((matrix, place) => {
    for (let point = 0; point < pointCount; point++) {
      elements.set(matrix.elements, (place * pointCount + point) * 16);
    }
  });
  return new THREE.BufferAttribute(elements, 16);
}

/**
 * Moves one place's copy of attribute `name` in place, as `BufferGeometry.applyMatrix4` moves a
 * geometry's: without a clone of the source for each place.
 */
function placeAttribute(
  name: string,
  attribute: THREE.BufferAttribute,
  matrix: THREE.Matrix4,
  normalMatrix: THREE.Matrix3
): void {
  if (name === 'position') attribute.applyMatrix4(matrix);
  else if (name === 'normal') attribute.applyNormalMatrix(normalMatrix);
  else if (name === 'tangent') attribute.transformDirection(matrix);
}

/** An empty array of `source`'s attribute `name`, long enough for `places` copies. */
function repeatedArray(source: THREE.BufferGeometry, name: string, places: number): THREE.TypedArray {
  const { array } = source.getAttribute(name);
  return new (array.constructor as TypedArrayConstructor)(array.length * places);
}

/** The ranges `source` draws: each group, or the whole geometry when it has none. */
function drawRanges(source: THREE.BufferGeometry): readonly { start: number; count: number }[] {
  if (source.groups.length) return source.groups;
  return [{ start: 0, count: source.index ? source.index.count : source.getAttribute('position').count }];
}

/** Each range of `source` in turn, with every place's vertices of it in place order. */
function placesIndex(source: THREE.BufferGeometry, places: number): Uint32Array {
  const ranges = drawRanges(source);
  const vertexCount = source.getAttribute('position').count;
  const rangeLength = ranges.reduce((sum, { count }) => sum + count, 0);
  const index = new Uint32Array(rangeLength * places);
  let written = 0;
  for (const { start, count } of ranges) {
    for (let place = 0; place < places; place++) {
      for (let i = start; i < start + count; i++) {
        index[written++] = (source.index ? source.index.getX(i) : i) + place * vertexCount;
      }
    }
  }
  return index;
}

/** One group for each group of `source`, over the range `placesIndex` gives it. */
function addGroupRanges(merged: THREE.BufferGeometry, source: THREE.BufferGeometry, places: number): void {
  let start = 0;
  for (const group of source.groups) {
    merged.addGroup(start, group.count * places, group.materialIndex);
    start += group.count * places;
  }
}
