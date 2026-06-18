/**
 * Decodes a Godot 4 text ArrayMesh (`.tres`, format=4) into per-surface typed
 * arrays for a THREE.BufferGeometry. Godot stores geometry as base64
 * `PackedByteArray` blobs interleaved per the surface's uint64 `format`
 * bitfield — this turns that on-disk layout back into positions / uvs / indices.
 *
 * Scope (first pass): uncompressed vertex layout (no ARRAY_FLAG_COMPRESS_
 * ATTRIBUTES), triangle primitive. Blend shapes / LODs / skins are ignored.
 */

import { parseTresFile } from '../../parser/tresParser.js';

/** Godot Mesh.ArrayFormat flags. */
const ARRAY_FORMAT_NORMAL = 1 << 1;
const ARRAY_FORMAT_TANGENT = 1 << 2;
const ARRAY_FORMAT_TEX_UV = 1 << 4;

/** Float32 position component size in the vertex buffer (uncompressed). */
const POSITION_STRIDE = 12;
/** Each of normal / tangent is a 2×uint16 octahedral pair (4 bytes). */
const OCT_PAIR_BYTES = 4;

/** One decoded mesh surface. */
export interface ArrayMeshSurface {
  /** Godot Mesh.ArrayFormat bitfield (uint64, fits in a JS number ≤ 2^53). */
  format: number;
  /** Godot primitive type (3 = TRIANGLES). */
  primitive: number;
  vertexCount: number;
  indexCount: number;
  /** Vertex positions, `vertexCount × 3` (x, y, z). */
  positions: Float32Array;
  /** UV1, `vertexCount × 2`; undefined when the surface has no TEX_UV. */
  uvs?: Float32Array;
  /** Per-vertex normals `vertexCount × 3`; undefined when the surface has none. */
  normals?: Float32Array;
  /** Triangle indices; width auto-detected (uint16 ≤ 65535 verts, else uint32). */
  indices: Uint16Array | Uint32Array;
  /** Resolved `res://` path of the surface's material, if it has one. */
  materialPath?: string;
}

export interface ArrayMeshData {
  surfaces: ArrayMeshSurface[];
}

/**
 * Each `_surfaces` entry is a flat dict `{ ... }`; base64 payloads use the
 * `A–Za–z0–9+/=` alphabet and the other values use `()` (AABB/Vector4/
 * ExtResource), so no braces appear inside a surface — a non-greedy
 * brace match isolates each surface reliably.
 */
function* iterateSurfaceBlocks(surfacesRaw: string): Generator<string> {
  const re = /\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(surfacesRaw)) !== null) {
    yield match[1]!;
  }
}

function readInt(block: string, key: string): number {
  const match = new RegExp(`"${key}"\\s*:\\s*(-?\\d+)`).exec(block);
  return match ? Number(match[1]) : 0;
}

/** Extract the base64 payload of a `"<key>": PackedByteArray("…")` field. */
function readPackedBytes(block: string, key: string): Uint8Array {
  const match = new RegExp(`"${key}"\\s*:\\s*PackedByteArray\\("([^"]*)"\\)`).exec(block);
  if (!match) return new Uint8Array(0);
  return Uint8Array.from(atob(match[1]!), (c) => c.charCodeAt(0));
}

/**
 * Read `floatsPerVertex` float32s per vertex from a buffer region.
 *
 * Godot 4 `vertex_data` is NOT interleaved: full-float positions form a
 * contiguous `12 B/vert` block at the front (followed by the packed
 * normal/tangent block). `attribute_data` likewise leads with UV1. So
 * positions read at a fixed 12-byte stride; UV1 reads at the region's derived
 * stride (UV1 first, any UV2/color trailing). Pass `strideBytes` to force the
 * contiguous case, or omit to derive it from the buffer size.
 */
function readLeadingFloats(
  bytes: Uint8Array,
  vertexCount: number,
  floatsPerVertex: number,
  strideBytes?: number
): Float32Array {
  const out = new Float32Array(vertexCount * floatsPerVertex);
  if (vertexCount === 0 || bytes.byteLength === 0) return out;
  const stride = strideBytes ?? bytes.byteLength / vertexCount;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < vertexCount; i++) {
    const base = i * stride;
    for (let f = 0; f < floatsPerVertex; f++) {
      out[i * floatsPerVertex + f] = view.getFloat32(base + f * 4, true);
    }
  }
  return out;
}

/**
 * Decode Godot's packed normals from `vertex_data`. The buffer lays positions
 * first (`12 B/vert`), then an interleaved normal+tangent block where each is a
 * 2×uint16 octahedral pair: `[normal(4)][tangent(4)]` per vertex. Returns
 * undefined when no normal block is present (so the caller can recompute them).
 */
function decodeNormals(
  bytes: Uint8Array,
  vertexCount: number,
  format: number
): Float32Array | undefined {
  if ((format & ARRAY_FORMAT_NORMAL) === 0 || vertexCount === 0) return undefined;
  const normalBlock = vertexCount * POSITION_STRIDE;
  // normal + (tangent if present) per vertex.
  const stride = OCT_PAIR_BYTES + ((format & ARRAY_FORMAT_TANGENT) !== 0 ? OCT_PAIR_BYTES : 0);
  if (bytes.byteLength < normalBlock + stride * vertexCount) return undefined;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i++) {
    const o = normalBlock + i * stride;
    // uint16 → [-1, 1] octahedral coordinates.
    const ex = (view.getUint16(o, true) / 65535) * 2 - 1;
    const ey = (view.getUint16(o + 2, true) / 65535) * 2 - 1;
    // Octahedron → unit vector (Godot's oct_to_norm).
    let nx = ex;
    let ny = ey;
    let nz = 1 - Math.abs(ex) - Math.abs(ey);
    const t = Math.max(-nz, 0);
    nx += nx >= 0 ? -t : t;
    ny += ny >= 0 ? -t : t;
    const len = Math.hypot(nx, ny, nz) || 1;
    out[i * 3 + 0] = nx / len;
    out[i * 3 + 1] = ny / len;
    out[i * 3 + 2] = nz / len;
  }
  return out;
}

/** uint16 when ≤ 65535 vertices, uint32 otherwise — detected from byte width. */
function decodeIndices(bytes: Uint8Array, indexCount: number): Uint16Array | Uint32Array {
  if (indexCount === 0) return new Uint16Array(0);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = bytes.byteLength / indexCount;
  if (width === 4) {
    const out = new Uint32Array(indexCount);
    for (let i = 0; i < indexCount; i++) out[i] = view.getUint32(i * 4, true);
    return out;
  }
  const out = new Uint16Array(indexCount);
  for (let i = 0; i < indexCount; i++) out[i] = view.getUint16(i * 2, true);
  return out;
}

/** Resolve a surface's `"material": ExtResource("id")` to its res:// path. */
function readMaterialPath(block: string, extById: Map<string, string>): string | undefined {
  const match = /"material"\s*:\s*ExtResource\("([^"]+)"\)/.exec(block);
  if (!match) return undefined;
  return extById.get(match[1]!);
}

export function decodeArrayMesh(content: string): ArrayMeshData {
  const parsed = parseTresFile(content);
  const surfacesRaw = parsed.properties['_surfaces'];
  if (!surfacesRaw) return { surfaces: [] };

  const extById = new Map(parsed.extResources.map((r) => [r.id, r.path]));

  const surfaces: ArrayMeshSurface[] = [];
  for (const block of iterateSurfaceBlocks(surfacesRaw)) {
    const format = readInt(block, 'format');
    const vertexCount = readInt(block, 'vertex_count');
    const indexCount = readInt(block, 'index_count');

    const vertexData = readPackedBytes(block, 'vertex_data');
    // Positions: contiguous 3×float32 at the front of vertex_data.
    const positions = readLeadingFloats(vertexData, vertexCount, 3, POSITION_STRIDE);
    // Normals: octahedral pairs in the block following the positions.
    const normals = decodeNormals(vertexData, vertexCount, format);
    // UV1: leads attribute_data; derive stride to skip any trailing UV2/color.
    const uvs =
      (format & ARRAY_FORMAT_TEX_UV) !== 0
        ? readLeadingFloats(readPackedBytes(block, 'attribute_data'), vertexCount, 2)
        : undefined;
    const indices = decodeIndices(readPackedBytes(block, 'index_data'), indexCount);

    surfaces.push({
      format,
      primitive: readInt(block, 'primitive'),
      vertexCount,
      indexCount,
      positions,
      uvs,
      normals,
      indices,
      materialPath: readMaterialPath(block, extById),
    });
  }
  return { surfaces };
}
