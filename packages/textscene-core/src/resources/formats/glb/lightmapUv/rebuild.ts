/**
 * Rebuilds a mesh's surfaces from its **Unwrap cache** entry, as `lightmap_unwrap_cached` does
 * after xatlas returns (`importer_mesh.cpp:1181-1226`): each output triangle takes its corners'
 * source vertices with every attribute they had, plus the cached UV2.
 */

import * as THREE from 'three';
import type { UnwrapCacheEntry } from './unwrapCache';
import type { UnwrapInput } from './unwrapInput';
import { UV2_ATTRIBUTE } from '../../../meshes/uv2';

/** One rebuilt surface: its output vertices in first-use order, and its triangles over them. */
interface SurfaceCorners {
  outputVertices: number[];
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
  const corners = unwrapped.map((): SurfaceCorners => ({ outputVertices: [], index: [] }));
  // An output vertex belongs to one surface, so one table numbers them for every surface.
  const slotOf = new Int32Array(entry.sourceVertices.length).fill(-1);
  for (let i = 0; i + 2 < entry.indices.length; i += 3) {
    const [a, b, c] = [entry.indices[i]!, entry.indices[i + 1]!, entry.indices[i + 2]!];
    const surface = corners[triangleSurface(a, b, c, input, entry)]!;
    // Godot's winding is the glTF winding with two corners swapped, so swap them back for three.
    addCorner(surface, slotOf, a);
    addCorner(surface, slotOf, c);
    addCorner(surface, slotOf, b);
  }
  return surfaces.map((geometry, surface) =>
    surface < unwrapped.length ? surfaceGeometry(geometry, corners[surface]!, input, entry) : null
  );
}

/** The one surface a triangle's corners come from (`importer_mesh.cpp:1186-1192`). */
function triangleSurface(
  a: number,
  b: number,
  c: number,
  input: UnwrapInput,
  entry: UnwrapCacheEntry
): number {
  const surfaceOf = (outputVertex: number): number =>
    input.vertexSurface[inputVertex(outputVertex, input, entry)]!;
  const [first, second, third] = [surfaceOf(a), surfaceOf(b), surfaceOf(c)];
  if (second !== first || third !== first) {
    throw new Error(`unwrap cache: a triangle spans surfaces ${first}, ${second} and ${third}`);
  }
  return first;
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

function addCorner(corners: SurfaceCorners, slotOf: Int32Array, outputVertex: number): void {
  if (slotOf[outputVertex] === -1) slotOf[outputVertex] = corners.outputVertices.push(outputVertex) - 1;
  corners.index.push(slotOf[outputVertex]!);
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
    if (name !== UV2_ATTRIBUTE) geometry.setAttribute(name, gathered(attribute, sourceVertices));
  }
  const uv2 = new Float32Array(corners.outputVertices.length * 2);
  corners.outputVertices.forEach((outputVertex, slot) =>
    uv2.set(entry.uvs.subarray(outputVertex * 2, outputVertex * 2 + 2), slot * 2)
  );
  geometry.setAttribute(UV2_ATTRIBUTE, new THREE.BufferAttribute(uv2, 2));
  geometry.setIndex(corners.index);
  return geometry;
}

/** The attribute's stored values at `vertices`, in its own component type. */
function gathered(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  vertices: readonly number[]
): THREE.BufferAttribute {
  const { itemSize } = attribute;
  const ArrayType = attribute.array.constructor as new (length: number) => THREE.TypedArray;
  const values = new ArrayType(vertices.length * itemSize);
  vertices.forEach((vertex, slot) => {
    for (let component = 0; component < itemSize; component++) {
      values[slot * itemSize + component] = storedComponent(attribute, vertex, component);
    }
  });
  return new THREE.BufferAttribute(values, itemSize, attribute.normalized);
}

/**
 * The component as its array stores it. `getComponent` denormalises a normalised attribute, and
 * its 0 to 1 value written back to an integer array truncates a colour or skin weight to 0 or 1.
 */
function storedComponent(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  vertex: number,
  component: number
): number {
  if ('isInterleavedBufferAttribute' in attribute) {
    return attribute.data.array[vertex * attribute.data.stride + attribute.offset + component]!;
  }
  return attribute.array[vertex * attribute.itemSize + component]!;
}
