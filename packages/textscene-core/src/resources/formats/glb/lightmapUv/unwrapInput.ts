/**
 * The input `ImporterMesh::lightmap_unwrap_cached` hands xatlas for a glTF mesh, reduced to what
 * the previewer needs: its MD5, which keys the **Unwrap cache**, and the surface vertex behind
 * each input vertex, which the rebuild reads attributes from (`importer_mesh.cpp:1039-1153`).
 */

import type * as THREE from 'three';
import { unwrapSpace } from '../../../../godot/importerBasis';
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

/** `eps`, which `importer_mesh.cpp:1102` takes from `xatlas.h`, as a float. */
const SHORTEST_EDGE_SQUARED = Math.fround(1.1920929e-7);

type Vector3 = [number, number, number];
type UnwrapSpace = ReturnType<typeof unwrapSpace>;

interface SurfaceInput {
  positions: Vector3[];
  normals: Vector3[];
  /** Triangles over this surface's input vertices, in Godot's winding. */
  triangles: number[];
  sources: number[];
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
  const normal = geometry.getAttribute('normal');
  const gltfIndices = geometry.index ? Array.from(geometry.index.array) : [...Array(position.count).keys()];
  const sources = usedVertices(gltfIndices, position.count);
  const inputVertexOf = new Map(sources.map((source, inputVertex) => [source, inputVertex]));

  // `_rescale_importer_mesh` multiplies each vertex by the baked root scale (`resource_importer_scene.cpp:500-505`).
  const scale = Math.fround(vertexScale);
  const positions = sources.map((source) =>
    space.position(vectorAt(position, source).map((component) => Math.fround(component * scale)) as Vector3)
  );
  const normals = sources.map((source) => space.normal(vectorAt(normal, source)));

  const triangles: number[] = [];
  for (let i = 0; i + 2 < gltfIndices.length; i += 3) {
    const corners = [gltfIndices[i]!, gltfIndices[i + 2]!, gltfIndices[i + 1]!].map((v) =>
      inputVertexOf.get(v)!
    );
    if (!hasShortEdge(corners.map((corner) => positions[corner]!))) triangles.push(...corners);
  }
  return { positions, normals, triangles, sources };
}

/** The vertices `indices` name, ascending, as the importer keeps them. */
function usedVertices(indices: readonly number[], vertexCount: number): number[] {
  const used = new Uint8Array(vertexCount);
  for (const index of indices) used[index] = 1;
  return [...used.keys()].filter((vertex) => used[vertex] === 1);
}

function vectorAt(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  index: number
): Vector3 {
  return [
    Math.fround(attribute.getX(index)),
    Math.fround(attribute.getY(index)),
    Math.fround(attribute.getZ(index)),
  ];
}

function hasShortEdge([p0, p1, p2]: Vector3[]): boolean {
  return [lengthSquared(p0!, p1!), lengthSquared(p1!, p2!), lengthSquared(p2!, p0!)].some(
    (edge) => edge < SHORTEST_EDGE_SQUARED
  );
}

/** `(a - b).length_squared()` in float32. */
function lengthSquared(a: Vector3, b: Vector3): number {
  const [x, y, z] = [0, 1, 2].map((axis) => Math.fround(a[axis]! - b[axis]!)) as Vector3;
  return Math.fround(Math.fround(Math.fround(x * x) + Math.fround(y * y)) + Math.fround(z * z));
}

/**
 * The MD5 `xatlas_mesh_lightmap_unwrap_callback` keys the cache on: the texel size, the indices,
 * the vertices and the normals (`register_types.cpp:39-46`). Each surface's indices are offset by
 * the vertices before it. Typed arrays use the platform's byte order, little-endian on every
 * browser and Node target, as the cache is.
 */
function inputHash(inputs: readonly SurfaceInput[], texelSize: number): string {
  const indices: number[] = [];
  let vertexOffset = 0;
  for (const input of inputs) {
    for (const corner of input.triangles) indices.push(corner + vertexOffset);
    vertexOffset += input.positions.length;
  }
  const bytesOf = (array: Float32Array | Int32Array): Uint8Array => new Uint8Array(array.buffer);
  return md5Hex([
    bytesOf(new Float32Array([texelSize])),
    bytesOf(Int32Array.from(indices)),
    bytesOf(Float32Array.from(inputs.flatMap((input) => input.positions.flat()))),
    bytesOf(Float32Array.from(inputs.flatMap((input) => input.normals.flat()))),
  ]);
}

/** The surface and geometry vertex of each input vertex, across every surface. */
function vertexOrigins(inputs: readonly SurfaceInput[]): Pick<UnwrapInput, 'vertexSurface' | 'vertexSource'> {
  const vertexSurface = Int32Array.from(inputs.flatMap((input, surface) => input.sources.map(() => surface)));
  const vertexSource = Int32Array.from(inputs.flatMap((input) => input.sources));
  return { vertexSurface, vertexSource };
}
