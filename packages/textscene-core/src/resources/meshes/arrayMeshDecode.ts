/**
 * Decodes a Godot 4 text ArrayMesh (`.tres`, format=4) into per-surface typed
 * arrays for a THREE.BufferGeometry. Godot stores geometry as base64
 * `PackedByteArray` blobs laid out per the surface's uint64 `format`
 * bitfield — this turns that on-disk layout back into positions / uvs / normals
 * / indices, recovering the same values Godot's own
 * `ArrayMesh.surface_get_arrays()` returns.
 *
 * `vertex_data` is TWO concatenated regions, not one interleaved record: the
 * positions, then the normal/tangent frame. `attribute_data` is a third,
 * interleaved, ordered COLOR then UV1 then UV2. Bytes per vertex:
 *
 * |            | uncompressed | ARRAY_FLAG_COMPRESS_ATTRIBUTES |
 * | ---------- | ------------ | ------------------------------ |
 * | position   | 3×float32    | 3×uint16 spanning the surface `aabb`, + the frame angle |
 * | normal     | 2×uint16 octahedral | shares 4 B with the tangent, as an axis-angle frame |
 * | tangent    | 2×uint16 octahedral | folded into the normal's 4 B    |
 * | UV1 / UV2  | 2×float32    | 2×uint16, re-expanded by `uv_scale` when non-zero |
 * | colour     | RGBA8        | RGBA8                          |
 *
 * Dequantising through `aabb` / `uv_scale` is decoding, not conversion: it
 * recovers Godot's own values. The Godot → three.js conversions (V flip,
 * triangle winding) stay in `arrayMeshGeometry.ts`.
 *
 * Scope: triangle primitive. Blend shapes / LODs / skins are ignored.
 */

import { warn } from '../../logger.js';
import { parseTresFile } from '../../parser/tresParser.js';
import { parseSubResourcePath, subResourcePath } from '../subResourcePath.js';

/** Godot Mesh.ArrayFormat flags. */
const ARRAY_FORMAT_NORMAL = 1 << 1;
const ARRAY_FORMAT_TANGENT = 1 << 2;
const ARRAY_FORMAT_COLOR = 1 << 3;
const ARRAY_FORMAT_TEX_UV = 1 << 4;
const ARRAY_FORMAT_TEX_UV2 = 1 << 5;
/**
 * Attributes are quantised. Only bits below 32 can be tested with `&`, which
 * coerces to int32 — every format Godot writes keeps its low 32 bits under 2^31
 * so this one survives, but `ARRAY_FLAG_FORMAT_VERSION_2` (1 << 35) could never
 * be read this way. Nothing here consults it: bit 29 alone selects the layout,
 * which also lets a fixture omit the version flag and still decode.
 */
const ARRAY_FLAG_COMPRESS_ATTRIBUTES = 1 << 29;

/** RGBA8 vertex colour, which Godot writes BEFORE UV1 in the attribute record. */
const COLOR_BYTES = 4;

/**
 * Byte geometry of one surface's buffers, mirroring Godot's
 * `RenderingServer::mesh_surface_make_offsets_from_format`. The single place any
 * byte size is decided, so a format combination is described once.
 */
interface SurfaceLayout {
  compressed: boolean;
  /** Bytes per vertex in `vertex_data`'s leading position region. */
  positionStride: number;
  /** Byte offset of `vertex_data`'s normal/tangent region. */
  normalRegionOffset: number;
  /** Bytes per vertex there: normal + tangent, both halved when compressed. */
  normalStride: number;
  /** Bytes per vertex in `attribute_data`, from the format — never derived. */
  attributeStride: number;
  /** Byte offset of UV1 within one attribute record; -1 when the surface has none. */
  uvOffset: number;
}

/** A surface's declared `AABB(px, py, pz, sx, sy, sz)` — a compressed surface's position scale. */
interface SurfaceAabb {
  position: [number, number, number];
  size: [number, number, number];
}

function surfaceLayout(format: number, vertexCount: number): SurfaceLayout {
  const compressed = (format & ARRAY_FLAG_COMPRESS_ATTRIBUTES) !== 0;
  const hasNormal = (format & ARRAY_FORMAT_NORMAL) !== 0;
  const hasTangent = (format & ARRAY_FORMAT_TANGENT) !== 0;
  const hasColor = (format & ARRAY_FORMAT_COLOR) !== 0;
  const hasUV = (format & ARRAY_FORMAT_TEX_UV) !== 0;
  const hasUV2 = (format & ARRAY_FORMAT_TEX_UV2) !== 0;

  // Compressed: 3×uint16 + the tangent-frame angle. Uncompressed: 3×float32.
  const positionStride = compressed ? 8 : 12;
  // Compressed folds the tangent into the normal's own 4 bytes (2 per octahedral
  // pair); uncompressed gives each pair its own 4.
  const normalStride = hasNormal ? (compressed ? 4 : 4 + (hasTangent ? 4 : 0)) : 0;
  const uvBytes = compressed ? 4 : 8;

  return {
    compressed,
    positionStride,
    normalRegionOffset: vertexCount * positionStride,
    normalStride,
    attributeStride:
      (hasColor ? COLOR_BYTES : 0) + (hasUV ? uvBytes : 0) + (hasUV2 ? uvBytes : 0),
    uvOffset: hasUV ? (hasColor ? COLOR_BYTES : 0) : -1,
  };
}

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

function readAabb(block: string): SurfaceAabb | undefined {
  const match = /"aabb"\s*:\s*AABB\(([^)]*)\)/.exec(block);
  if (!match) return undefined;
  const n = match[1]!.split(',').map((v) => Number(v.trim()));
  if (n.length < 6 || n.some((v) => !Number.isFinite(v))) return undefined;
  return { position: [n[0]!, n[1]!, n[2]!], size: [n[3]!, n[4]!, n[5]!] };
}

function readVector4(block: string, key: string): [number, number, number, number] | undefined {
  const match = new RegExp(`"${key}"\\s*:\\s*Vector4\\(([^)]*)\\)`).exec(block);
  if (!match) return undefined;
  const n = match[1]!.split(',').map((v) => Number(v.trim()));
  if (n.length < 4 || n.some((v) => !Number.isFinite(v))) return undefined;
  return [n[0]!, n[1]!, n[2]!, n[3]!];
}

function readName(block: string): string | undefined {
  const match = /"name"\s*:\s*"([^"]*)"/.exec(block);
  return match?.[1];
}

/** Extract the base64 payload of a `"<key>": PackedByteArray("…")` field. */
function readPackedBytes(block: string, key: string): Uint8Array {
  const match = new RegExp(`"${key}"\\s*:\\s*PackedByteArray\\("([^"]*)"\\)`).exec(block);
  if (!match) return new Uint8Array(0);
  return Uint8Array.from(atob(match[1]!), (c) => c.charCodeAt(0));
}

/** Read `floatsPerVertex` float32s per vertex at a fixed stride. */
function readFloats(
  bytes: Uint8Array,
  vertexCount: number,
  floatsPerVertex: number,
  strideBytes: number
): Float32Array {
  const out = new Float32Array(vertexCount * floatsPerVertex);
  if (vertexCount === 0 || bytes.byteLength === 0) return out;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < vertexCount; i++) {
    const base = i * strideBytes;
    for (let f = 0; f < floatsPerVertex; f++) {
      out[i * floatsPerVertex + f] = view.getFloat32(base + f * 4, true);
    }
  }
  return out;
}

/**
 * Read a surface's positions, or undefined when the surface cannot be read at
 * all: `vertex_data` too short for the vertices it declares, a compressed
 * surface with no `aabb` to dequantise against, or a component that is not
 * finite. A non-finite position is not a local defect — surfaces merge into one
 * THREE.BufferGeometry, so one NaN poisons the whole mesh's bounding sphere, and
 * with it the camera framing.
 *
 * A compressed position is a uint16 per axis spanning the surface's own `aabb`,
 * so the aabb is the scale, not just metadata.
 */
function decodePositions(
  bytes: Uint8Array,
  vertexCount: number,
  layout: SurfaceLayout,
  aabb: SurfaceAabb | undefined
): Float32Array | undefined {
  if (vertexCount === 0) return new Float32Array(0);
  if (bytes.byteLength < vertexCount * layout.positionStride) return undefined;

  let positions: Float32Array;
  if (layout.compressed) {
    if (!aabb) return undefined;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    positions = new Float32Array(vertexCount * 3);
    for (let i = 0; i < vertexCount; i++) {
      const base = i * layout.positionStride;
      for (let axis = 0; axis < 3; axis++) {
        const unit = view.getUint16(base + axis * 2, true) / 65535;
        positions[i * 3 + axis] = unit * aabb.size[axis]! + aabb.position[axis]!;
      }
    }
  } else {
    positions = readFloats(bytes, vertexCount, 3, layout.positionStride);
  }

  for (const p of positions) if (!Number.isFinite(p)) return undefined;
  return positions;
}

/**
 * Read UV1 out of `attribute_data`, whose record Godot orders COLOR, UV1, UV2 —
 * so a surface with vertex colours puts 4 RGBA8 bytes ahead of UV1.
 *
 * Uncompressed UV1 is 2×float32. Compressed is 2×uint16 spanning the unit range,
 * unless the surface declares a non-zero `uv_scale`: Godot normalises UVs that
 * leave the unit range into the uint16 range and keeps the divisor there, so the
 * stored value has to be re-expanded around 0.5.
 *
 * Returns undefined when the record is not the width the format implies — an
 * unmodelled CUSTOM0..3 channel puts UV1 somewhere this cannot find, and wrong
 * UVs are worse than none.
 */
function decodeUVs(
  bytes: Uint8Array,
  vertexCount: number,
  layout: SurfaceLayout,
  uvScale: [number, number, number, number] | undefined,
  onMismatch: (actualStride: number) => void
): Float32Array | undefined {
  if (layout.uvOffset < 0 || vertexCount === 0 || bytes.byteLength === 0) return undefined;
  if (bytes.byteLength !== vertexCount * layout.attributeStride) {
    onMismatch(bytes.byteLength / vertexCount);
    return undefined;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Float32Array(vertexCount * 2);
  const scaleU = uvScale?.[0] ?? 0;
  const scaleV = uvScale?.[1] ?? 0;
  const rescale = scaleU !== 0 || scaleV !== 0;

  for (let i = 0; i < vertexCount; i++) {
    const o = i * layout.attributeStride + layout.uvOffset;
    if (!layout.compressed) {
      out[i * 2 + 0] = view.getFloat32(o, true);
      out[i * 2 + 1] = view.getFloat32(o + 4, true);
      continue;
    }
    const u = view.getUint16(o, true) / 65535;
    const v = view.getUint16(o + 2, true) / 65535;
    out[i * 2 + 0] = rescale ? (u - 0.5) * scaleU : u;
    out[i * 2 + 1] = rescale ? (v - 0.5) * scaleV : v;
  }
  return out;
}

/** Octahedron → unit vector, Godot's `Vector3::octahedron_decode`. */
function octToVec3(ex: number, ey: number): [number, number, number] {
  let nx = ex;
  let ny = ey;
  const nz = 1 - Math.abs(ex) - Math.abs(ey);
  const t = Math.max(-nz, 0);
  nx += nx >= 0 ? -t : t;
  ny += ny >= 0 ? -t : t;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

/**
 * Decode Godot's packed normals from `vertex_data`, which lays the position
 * region first and the normal/tangent region after it.
 *
 * Uncompressed stores the normal directly: a 2×uint16 octahedral pair, followed
 * by the tangent's own pair.
 *
 * Compressed stores no normal at all. It keeps a rotation AXIS as the octahedral
 * pair and the rotation ANGLE as the 4th uint16 of the position record (in
 * half-turns), and the whole tangent frame follows from Godot's
 * `axis_angle_to_tbn` — the normal is that rotation matrix's third row. Reading
 * the pair as if it were a normal gives a direction unrelated to the surface.
 *
 * Returns undefined when there is no normal region, so the caller can recompute.
 */
function decodeNormals(
  bytes: Uint8Array,
  vertexCount: number,
  layout: SurfaceLayout
): Float32Array | undefined {
  const { normalRegionOffset: normalBlock, normalStride: stride } = layout;
  if (stride === 0 || vertexCount === 0) return undefined;
  if (bytes.byteLength < normalBlock + stride * vertexCount) return undefined;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i++) {
    const o = normalBlock + i * stride;
    // uint16 → [-1, 1] octahedral coordinates.
    const ex = (view.getUint16(o, true) / 65535) * 2 - 1;
    const ey = (view.getUint16(o + 2, true) / 65535) * 2 - 1;
    const [ax, ay, az] = octToVec3(ex, ey);

    if (!layout.compressed) {
      out[i * 3 + 0] = ax;
      out[i * 3 + 1] = ay;
      out[i * 3 + 2] = az;
      continue;
    }

    const angle =
      ((view.getUint16(i * layout.positionStride + 6, true) / 65535) * 2 - 1) * Math.PI;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const omc = 1 - cos;
    const nx = omc * az * ax - sin * ay;
    const ny = omc * az * ay + sin * ax;
    const nz = omc * az * az + cos;
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

/**
 * Resolve a surface's `"material"` to the resource path that addresses it.
 * Godot writes either form: an `ExtResource` when the surface points at a shared
 * material file, or a `SubResource` when the mesh carries its own — in which
 * case the material lives inside THIS file and is addressed by a **Sub-resource
 * path** (`selfPath::id`). Both come back as one path string, so nothing
 * downstream has to distinguish them.
 */
function readMaterialPath(
  block: string,
  extById: Map<string, string>,
  selfPath: string
): string | undefined {
  const match = /"material"\s*:\s*(ExtResource|SubResource)\("([^"]+)"\)/.exec(block);
  if (!match) return undefined;
  const id = match[2]!;
  return match[1] === 'ExtResource' ? extById.get(id) : subResourcePath(selfPath, id);
}

/**
 * @param selfPath - the resource path this mesh was requested under. A material
 *   declared as a `[sub_resource]` here can only be addressed relative to its
 *   own file, so this is an input, not a convenience. May itself be a
 *   **Sub-resource path**, which selects a `[sub_resource type="ArrayMesh"]`
 *   inside the file (a `shadow_mesh`, or a MeshLibrary's embedded item mesh)
 *   rather than the file's own `[resource]` body.
 */
export function decodeArrayMesh(content: string, selfPath: string): ArrayMeshData {
  const parsed = parseTresFile(content);
  const { filePath, subResourceId } = parseSubResourcePath(selfPath);

  let surfacesRaw: string | undefined;
  if (subResourceId === undefined) {
    surfacesRaw = parsed.properties['_surfaces'];
  } else {
    // An addressed sub-resource that is absent, or present but carrying no
    // surfaces (a material, say), would otherwise decode to an empty mesh: a
    // node that renders nothing and says nothing about why. The material path
    // fails loudly for the same class of error; match it.
    const sub = parsed.subResources.find((r) => r.id === subResourceId);
    const raw = sub?.data['_surfaces'];
    if (!sub) {
      warn(
        `[ArrayMesh] ${filePath} declares no sub-resource "${subResourceId}" — ` +
          `the mesh addressing it renders nothing`
      );
    } else if (typeof raw !== 'string') {
      warn(
        `[ArrayMesh] sub-resource "${subResourceId}" in ${filePath} is a ${sub.type} ` +
          `and carries no surfaces — the mesh addressing it renders nothing`
      );
    } else {
      surfacesRaw = raw;
    }
  }
  if (!surfacesRaw) return { surfaces: [] };

  const extById = new Map(parsed.extResources.map((r) => [r.id, r.path]));

  const surfaces: ArrayMeshSurface[] = [];
  let surfaceIndex = -1;
  for (const block of iterateSurfaceBlocks(surfacesRaw)) {
    surfaceIndex++;
    const format = readInt(block, 'format');
    const vertexCount = readInt(block, 'vertex_count');
    const indexCount = readInt(block, 'index_count');

    const layout = surfaceLayout(format, vertexCount);
    const vertexData = readPackedBytes(block, 'vertex_data');
    // Positions: a contiguous region at the front of vertex_data.
    const positions = decodePositions(vertexData, vertexCount, layout, readAabb(block));
    if (!positions) {
      const name = readName(block);
      warn(
        `[ArrayMesh] surface ${surfaceIndex}${name ? ` "${name}"` : ''} has no decodable ` +
          `positions (format ${format}, ${vertexCount} verts, ${vertexData.byteLength} B ` +
          `vertex_data) — dropping the surface so the rest of the mesh still renders`
      );
      continue;
    }
    // Normals: octahedral pairs in the region following the positions.
    const normals = decodeNormals(vertexData, vertexCount, layout);
    const uvs = decodeUVs(
      readPackedBytes(block, 'attribute_data'),
      vertexCount,
      layout,
      readVector4(block, 'uv_scale'),
      (actualStride) =>
        warn(
          `[ArrayMesh] surface ${surfaceIndex}'s attribute_data is ${actualStride} B/vertex, ` +
            `not the ${layout.attributeStride} B format ${format} implies — dropping its UVs`
        )
    );
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
      materialPath: readMaterialPath(block, extById, filePath),
    });
  }
  return { surfaces };
}
