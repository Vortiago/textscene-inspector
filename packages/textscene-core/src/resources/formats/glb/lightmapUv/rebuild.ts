/**
 * Rebuilds a mesh's surfaces from its **Unwrap cache** entry, as `lightmap_unwrap_cached` does
 * after xatlas returns (`importer_mesh.cpp:1181-1226`): each output triangle takes its corners'
 * source vertices with every attribute they had, plus the cached UV2 as `uv1`.
 */

import * as THREE from 'three';
import type { UnwrapCacheEntry } from './unwrapCache';
import type { UnwrapInput } from './unwrapInput';

/** One rebuilt surface: its output vertices in first-use order, and its triangles over them. */
interface SurfaceCorners {
  outputVertices: number[];
  slotOf: Map<number, number>;
  index: number[];
}

/**
 * The surfaces rebuilt from `entry`, one per surface of `surfaces`, and null for a surface the
 * unwrap leaves out, which Godot's rebuilt mesh lacks. The cache order of triangles stays:
 * Godot's later `optimize_indices` reorders them, which draws the same picture. Throws when the
 * entry names a vertex the input lacks, or a triangle spans two surfaces.
 */
export function rebuildSurfaces(
  surfaces: readonly THREE.BufferGeometry[],
  input: UnwrapInput,
  entry: UnwrapCacheEntry
): (THREE.BufferGeometry | null)[] {
  const unwrapped = surfaces.slice(0, input.surfaceCount);
  const corners = unwrapped.map((): SurfaceCorners => ({ outputVertices: [], slotOf: new Map(), index: [] }));
  for (let i = 0; i < entry.indices.length; i += 3) {
    const triangle = [entry.indices[i]!, entry.indices[i + 1]!, entry.indices[i + 2]!];
    const surface = triangleSurface(triangle, input, entry);
    // Godot's winding is the glTF winding with two corners swapped, so swap them back for three.
    for (const outputVertex of [triangle[0]!, triangle[2]!, triangle[1]!])
      addCorner(corners[surface]!, outputVertex);
  }
  return surfaces.map((geometry, surface) =>
    surface < unwrapped.length ? surfaceGeometry(geometry, corners[surface]!, input, entry) : null
  );
}

/** The one surface a triangle's corners come from (`importer_mesh.cpp:1186-1192`). */
function triangleSurface(triangle: readonly number[], input: UnwrapInput, entry: UnwrapCacheEntry): number {
  const [first, ...rest] = triangle.map(
    (outputVertex) => input.vertexSurface[inputVertex(outputVertex, input, entry)]!
  );
  if (rest.some((surface) => surface !== first)) {
    throw new Error(`unwrap cache: a triangle spans surfaces ${first} and ${rest.join(', ')}`);
  }
  return first!;
}

function inputVertex(outputVertex: number, input: UnwrapInput, entry: UnwrapCacheEntry): number {
  const vertexCount = entry.sourceVertices.length;
  if (outputVertex < 0 || outputVertex >= vertexCount) {
    throw new Error(
      `unwrap cache: a triangle names output vertex ${outputVertex}, the entry has ${vertexCount}`
    );
  }
  const source = entry.sourceVertices[outputVertex]!;
  const inputCount = input.vertexSource.length;
  if (source < 0 || source >= inputCount) {
    throw new Error(
      `unwrap cache: output vertex ${outputVertex} names input vertex ${source}, the input has ${inputCount}`
    );
  }
  return source;
}

function addCorner(corners: SurfaceCorners, outputVertex: number): void {
  let slot = corners.slotOf.get(outputVertex);
  if (slot === undefined) {
    slot = corners.outputVertices.push(outputVertex) - 1;
    corners.slotOf.set(outputVertex, slot);
  }
  corners.index.push(slot);
}

function surfaceGeometry(
  source: THREE.BufferGeometry,
  corners: SurfaceCorners,
  input: UnwrapInput,
  entry: UnwrapCacheEntry
): THREE.BufferGeometry {
  const sourceVertices = corners.outputVertices.map(
    (outputVertex) => input.vertexSource[entry.sourceVertices[outputVertex]!]!
  );
  const geometry = new THREE.BufferGeometry();
  geometry.name = source.name;
  for (const [name, attribute] of Object.entries(source.attributes)) {
    if (name !== 'uv1') geometry.setAttribute(name, gathered(attribute, sourceVertices));
  }
  const uv2 = new Float32Array(corners.outputVertices.length * 2);
  corners.outputVertices.forEach((outputVertex, slot) =>
    uv2.set(entry.uvs.subarray(outputVertex * 2, outputVertex * 2 + 2), slot * 2)
  );
  geometry.setAttribute('uv1', new THREE.BufferAttribute(uv2, 2));
  geometry.setIndex(corners.index);
  return geometry;
}

/** The attribute's values at `vertices`, in its own component type. */
function gathered(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  vertices: readonly number[]
): THREE.BufferAttribute {
  const { itemSize } = attribute;
  const ArrayType = attribute.array.constructor as new (length: number) => THREE.TypedArray;
  const values = new ArrayType(vertices.length * itemSize);
  vertices.forEach((vertex, slot) => {
    for (let component = 0; component < itemSize; component++) {
      values[slot * itemSize + component] = attribute.getComponent(vertex, component);
    }
  });
  return new THREE.BufferAttribute(values, itemSize, attribute.normalized);
}
