/**
 * The input `ImporterMesh::lightmap_unwrap_cached` hands xatlas for a glTF mesh, reduced to what
 * the previewer needs: its MD5, which keys the **Unwrap cache**, and the surface vertex behind
 * each input vertex, which the rebuild reads attributes from (`importer_mesh.cpp:1039-1153`).
 */

import type * as THREE from 'three';
import { unwrapSpace } from '../../../../godot/importerBasis';
import { UNWRAP_SHORTEST_EDGE_SQUARED } from '../../../../godot/sceneImport';
import { md5Hex } from './md5';

/** Where the importer has put the mesh by the time it unwraps. */
export interface UnwrapPlacement {
  /** The column lengths of the mesh node's transform chain. */
  scale: readonly [number, number, number];
  /** A root scale `nodes/apply_root_scale` baked into the vertices, else 1. */
  vertexScale: number;
}

export interface UnwrapInput {
  hash: string;
  /** The leading surfaces the unwrap covers. The rest have no normals. */
  surfaceCount: number;
  /** The surface of each input vertex. */
  vertexSurface: Int32Array;
  /** The geometry vertex of each input vertex, within its surface. */
  vertexSource: Int32Array;
}

const f = Math.fround;

/** Marks in `usedVertices` before a used vertex takes its input number, which is never negative. */
const UNUSED = -1;
const USED = -2;

type UnwrapSpace = ReturnType<typeof unwrapSpace>;

interface SurfaceInput {
  /** The input vertices' positions, `xyz` per vertex. */
  positions: Float32Array;
  normals: Float32Array;
  /** Triangles over this surface's input vertices, in Godot's winding. */
  triangles: Int32Array;
  /** The geometry vertex of each input vertex. */
  sources: Int32Array;
}

/**
 * The unwrap input of a mesh whose primitives are `surfaces`. Godot leaves a surface without
 * normals out (`importer_mesh.cpp:1076`) and its rebuilt mesh lacks it. One that precedes a
 * surface with normals breaks the rebuild's surface lookup, which crashes Godot 4.6.3 (measured),
 * so that mesh, like one with no normals at all, has no input: null.
 */
export function unwrapInput(
  surfaces: readonly THREE.BufferGeometry[],
  placement: UnwrapPlacement,
  texelSize: number
): UnwrapInput | null {
  const surfaceCount = surfaces.findIndex((geometry) => !geometry.getAttribute('normal'));
  const unwrapped = surfaceCount === -1 ? surfaces : surfaces.slice(0, surfaceCount);
  const bareAfter = surfaces.slice(unwrapped.length);
  if (unwrapped.length === 0 || bareAfter.some((geometry) => geometry.getAttribute('normal'))) return null;

  const space = unwrapSpace(placement.scale);
  const inputs = unwrapped.map((geometry) => surfaceInput(geometry, placement.vertexScale, space));
  return { hash: inputHash(inputs, texelSize), surfaceCount: inputs.length, ...vertexOrigins(inputs) };
}

/**
 * One surface as `_parse_meshes` imports it: only the vertices its indices use, in file order
 * (`gltf_document.cpp:1498-1519`), each triangle with its second and third index swapped
 * (`:1486-1494`, `:1700-1714`), less the triangles with an edge too short to unwrap (`:1102-1135`).
 */
function surfaceInput(geometry: THREE.BufferGeometry, vertexScale: number, space: UnwrapSpace): SurfaceInput {
  const position = geometry.getAttribute('position');
  const gltfIndices =
    geometry.index?.array ?? Int32Array.from({ length: position.count }, (_, vertex) => vertex);
  const { sources, inputVertexOf } = usedVertices(gltfIndices, position.count);

  // `_rescale_importer_mesh` multiplies each vertex by the baked root scale (`resource_importer_scene.cpp:500-505`).
  const positions = gathered(position, sources, f(vertexScale));
  space.transformPositions(positions);
  const normals = gathered(geometry.getAttribute('normal'), sources, 1);
  space.transformNormals(normals);

  const triangles = new Int32Array(gltfIndices.length);
  let corners = 0;
  for (let i = 0; i + 2 < gltfIndices.length; i += 3) {
    const a = inputVertexOf[gltfIndices[i]!]!;
    const b = inputVertexOf[gltfIndices[i + 2]!]!;
    const c = inputVertexOf[gltfIndices[i + 1]!]!;
    if (hasShortEdge(positions, a, b, c)) continue;
    triangles.set([a, b, c], corners);
    corners += 3;
  }
  return { positions, normals, triangles: triangles.subarray(0, corners), sources };
}

/**
 * The vertices `indices` name, ascending, as the importer keeps them, and the input vertex each
 * geometry vertex becomes.
 */
function usedVertices(
  indices: ArrayLike<number>,
  vertexCount: number
): { sources: Int32Array; inputVertexOf: Int32Array } {
  const inputVertexOf = new Int32Array(vertexCount).fill(UNUSED);
  for (let i = 0; i < indices.length; i++) inputVertexOf[indices[i]!] = USED;
  const sources: number[] = [];
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    if (inputVertexOf[vertex] === USED) inputVertexOf[vertex] = sources.push(vertex) - 1;
  }
  return { sources: Int32Array.from(sources), inputVertexOf };
}

/** The attribute's `xyz` at each of `sources`, as float32 times `scale`. */
function gathered(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  sources: Int32Array,
  scale: number
): Float32Array {
  const xyz = new Float32Array(sources.length * 3);
  sources.forEach((source, vertex) => {
    xyz[3 * vertex] = f(f(attribute.getX(source)) * scale);
    xyz[3 * vertex + 1] = f(f(attribute.getY(source)) * scale);
    xyz[3 * vertex + 2] = f(f(attribute.getZ(source)) * scale);
  });
  return xyz;
}

function hasShortEdge(positions: Float32Array, a: number, b: number, c: number): boolean {
  return (
    lengthSquared(positions, a, b) < UNWRAP_SHORTEST_EDGE_SQUARED ||
    lengthSquared(positions, b, c) < UNWRAP_SHORTEST_EDGE_SQUARED ||
    lengthSquared(positions, c, a) < UNWRAP_SHORTEST_EDGE_SQUARED
  );
}

/** `(p[a] - p[b]).length_squared()` in float32. */
function lengthSquared(positions: Float32Array, a: number, b: number): number {
  const x = f(positions[3 * a]! - positions[3 * b]!);
  const y = f(positions[3 * a + 1]! - positions[3 * b + 1]!);
  const z = f(positions[3 * a + 2]! - positions[3 * b + 2]!);
  return f(f(f(x * x) + f(y * y)) + f(z * z));
}

/**
 * The MD5 `xatlas_mesh_lightmap_unwrap_callback` keys the cache on: the texel size, the indices,
 * the vertices and the normals (`register_types.cpp:39-46`). Each surface's indices are offset by
 * the vertices before it. Typed arrays use the platform's byte order, little-endian on every
 * browser and Node target, as the cache is.
 */
function inputHash(inputs: readonly SurfaceInput[], texelSize: number): string {
  const indices = new Int32Array(inputs.reduce((count, input) => count + input.triangles.length, 0));
  let corner = 0;
  let vertexOffset = 0;
  for (const input of inputs) {
    for (const inputVertex of input.triangles) indices[corner++] = inputVertex + vertexOffset;
    vertexOffset += input.sources.length;
  }
  const bytesOf = (array: Float32Array | Int32Array): Uint8Array =>
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  return md5Hex([
    bytesOf(new Float32Array([texelSize])),
    bytesOf(indices),
    ...inputs.map((input) => bytesOf(input.positions)),
    ...inputs.map((input) => bytesOf(input.normals)),
  ]);
}

/** The surface and geometry vertex of each input vertex, across every surface. */
function vertexOrigins(inputs: readonly SurfaceInput[]): Pick<UnwrapInput, 'vertexSurface' | 'vertexSource'> {
  const vertexCount = inputs.reduce((count, input) => count + input.sources.length, 0);
  const vertexSurface = new Int32Array(vertexCount);
  const vertexSource = new Int32Array(vertexCount);
  let first = 0;
  inputs.forEach((input, surface) => {
    vertexSurface.fill(surface, first, first + input.sources.length);
    vertexSource.set(input.sources, first);
    first += input.sources.length;
  });
  return { vertexSurface, vertexSource };
}
