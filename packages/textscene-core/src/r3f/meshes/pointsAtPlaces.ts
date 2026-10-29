/**
 * A points geometry at each of several places as one geometry, since three has no instanced form of
 * `THREE.Points`: a GridMap item at its cells, a particle emitter's mesh at its particles. Each
 * place's matrix moves its points and turns their normals.
 */

import * as THREE from 'three';

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
  matrices.forEach((matrix, place) => {
    const placeGeometry = source.clone().applyMatrix4(matrix);
    for (const [name, array] of placed) {
      array.set(placeGeometry.getAttribute(name).array, place * source.getAttribute(name).array.length);
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
