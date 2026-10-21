/**
 * Reads a surface's `vertex_data`, `attribute_data` and `index_data` into typed
 * arrays holding what Godot's `ArrayMesh.surface_get_arrays()` returns, so
 * dequantising through `aabb` / `uv_scale` belongs here. The conversions to
 * three.js (V flip, triangle winding) live in `../godotSurface.ts`.
 */

import type { SurfaceAabb, UvScale } from './surfaceFields.js';
import type { SurfaceLayout } from './surfaceFormat.js';

/**
 * A surface's positions, or undefined for `vertex_data` too short for its count,
 * a compressed surface with no `aabb` (its uint16 axes span that aabb), or a
 * non-finite component: surfaces merge into one geometry, so one NaN poisons the
 * whole mesh's bounding sphere and the camera framing.
 */
export function decodePositions(
  bytes: Uint8Array,
  vertexCount: number,
  layout: SurfaceLayout,
  aabb: SurfaceAabb | undefined
): Float32Array | undefined {
  if (vertexCount === 0) return new Float32Array(0);
  if (bytes.byteLength < vertexCount * layout.positionStride) return undefined;
  if (layout.compressed && !aabb) return undefined;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const positions = new Float32Array(vertexCount * 3);
  const stride = layout.positionStride;

  if (layout.compressed) {
    const [ox, oy, oz] = aabb!.position;
    const [sx, sy, sz] = aabb!.size;
    for (let i = 0; i < vertexCount; i++) {
      const b = i * stride;
      const o = i * 3;
      positions[o] = (view.getUint16(b, true) / 65535) * sx + ox;
      positions[o + 1] = (view.getUint16(b + 2, true) / 65535) * sy + oy;
      positions[o + 2] = (view.getUint16(b + 4, true) / 65535) * sz + oz;
    }
    // Quantised positions are finite by construction: a uint16 over a finite
    // aabb cannot be NaN, and `readAabb` rejects a non-finite aabb.
    return positions;
  }

  // float32s straight out of the file can be anything, including a NaN bit
  // pattern, so they are checked as they are read rather than in a second pass.
  for (let i = 0; i < vertexCount; i++) {
    const b = i * stride;
    const o = i * 3;
    for (let axis = 0; axis < 3; axis++) {
      const value = view.getFloat32(b + axis * 4, true);
      if (!Number.isFinite(value)) return undefined;
      positions[o + axis] = value;
    }
  }
  return positions;
}

/** The UV sets of one surface, each undefined when the surface has none. */
interface UvSets {
  uvs?: Float32Array;
  uv2s?: Float32Array;
}

/**
 * UV1 and UV2 from `attribute_data`, or none when the record is narrower than the format
 * implies: wrong UVs are worse than none. A compressed UV is 2×uint16 over the unit range.
 * A non-zero `uv_scale` holds the divisors Godot normalised out-of-range UVs by, so each set
 * re-expands around 0.5 (`rendering_server.cpp:1556-1557`, `:1581-1582`).
 */
export function decodeUVs(
  bytes: Uint8Array,
  vertexCount: number,
  layout: SurfaceLayout,
  uvScale: UvScale | undefined,
  onMismatch: (actualStride: number) => void
): UvSets {
  if ((layout.uvOffset < 0 && layout.uv2Offset < 0) || vertexCount === 0 || bytes.byteLength === 0) return {};

  // Godot orders the record COLOR, UV1, UV2, CUSTOM0..3, so vertex colours put 4
  // RGBA8 bytes ahead of UV1 and a wider record (an unmodelled CUSTOM channel)
  // reads fine at its stride. A record too narrow or not dividing evenly puts
  // the UVs somewhere else, so they go.
  const attributeStride = bytes.byteLength / vertexCount;
  if (!Number.isInteger(attributeStride) || attributeStride < layout.attributeStride) {
    onMismatch(attributeStride);
    return {};
  }
  const record = {
    view: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    attributeStride,
    vertexCount,
    compressed: layout.compressed,
  };
  // Godot re-expands when any component of the whole Vector4 is non-zero.
  const scale = uvScale && uvScale.some((component) => component !== 0) ? uvScale : undefined;
  return {
    uvs: decodeUvSet(record, layout.uvOffset, scale && [scale[0], scale[1]]),
    uv2s: decodeUvSet(record, layout.uv2Offset, scale && [scale[2], scale[3]]),
  };
}

interface AttributeRecords {
  view: DataView;
  attributeStride: number;
  vertexCount: number;
  compressed: boolean;
}

/** One UV set at `offset` in each record, re-expanded by `scale` when given. */
function decodeUvSet(
  { view, attributeStride, vertexCount, compressed }: AttributeRecords,
  offset: number,
  scale: readonly [number, number] | undefined
): Float32Array | undefined {
  if (offset < 0) return undefined;
  const out = new Float32Array(vertexCount * 2);
  if (!compressed) {
    for (let i = 0; i < vertexCount; i++) {
      const o = i * attributeStride + offset;
      out[i * 2] = view.getFloat32(o, true);
      out[i * 2 + 1] = view.getFloat32(o + 4, true);
    }
    return out;
  }
  for (let i = 0; i < vertexCount; i++) {
    const o = i * attributeStride + offset;
    const u = view.getUint16(o, true) / 65535;
    const v = view.getUint16(o + 2, true) / 65535;
    out[i * 2] = scale ? (u - 0.5) * scale[0] : u;
    out[i * 2 + 1] = scale ? (v - 0.5) * scale[1] : v;
  }
  return out;
}

/** A surface's normals and tangents, each undefined when the surface stores none. */
export interface NormalFrame {
  normals?: Float32Array;
  /** `xyzw` per vertex, `w` the binormal sign. */
  tangents?: Float32Array;
}

/**
 * Normals and tangents from the region after the positions, as `surface_get_arrays` returns
 * them, so a caller recomputes what is missing. Uncompressed stores a 2×uint16 octahedral
 * normal and, after it, an octahedral tangent. Compressed stores a rotation axis there and the
 * angle in the 4th uint16 of the position record (`rendering_server.cpp:1459-1482`).
 */
export function decodeNormalFrame(
  bytes: Uint8Array,
  vertexCount: number,
  layout: SurfaceLayout
): NormalFrame {
  const { normalStride: stride, positionStride } = layout;
  if (stride === 0 || vertexCount === 0) return {};
  const normalBlock = vertexCount * positionStride;
  if (bytes.byteLength < normalBlock + stride * vertexCount) return {};

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // A uint16 pair → Godot's [0, 1] octahedral coordinates. The two layouts read it differently,
  // so they get a loop each rather than a per-vertex test of something that cannot change.
  const pair = (o: number): [number, number] => [
    view.getUint16(o, true) / 65535,
    view.getUint16(o + 2, true) / 65535,
  ];
  const normals = new Float32Array(vertexCount * 3);

  if (layout.tangent === 'frame') {
    const tangents = new Float32Array(vertexCount * 4);
    for (let i = 0; i < vertexCount; i++) {
      const axis = octahedronDecode(...pair(normalBlock + i * stride));
      const angle = view.getUint16(i * positionStride + 6, true) / 65535;
      writeAxisAngleFrame(axis, angle, normals, tangents, i);
    }
    return { normals, tangents };
  }

  const tangents = layout.tangent === 'octahedral' ? new Float32Array(vertexCount * 4) : undefined;
  for (let i = 0; i < vertexCount; i++) {
    const record = normalBlock + i * stride;
    normals.set(octahedronDecode(...pair(record)), i * 3);
    if (tangents) writeOctahedralTangent(pair(record + 4), tangents, i);
  }
  return { normals, tangents };
}

/** Godot's `Vector3::octahedron_decode` (`vector3.cpp:107-114`), from [0, 1] coordinates. */
function octahedronDecode(u: number, v: number): [number, number, number] {
  let nx = u * 2 - 1;
  let ny = v * 2 - 1;
  const nz = 1 - Math.abs(nx) - Math.abs(ny);
  const t = Math.max(-nz, 0);
  nx += nx >= 0 ? -t : t;
  ny += ny >= 0 ? -t : t;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

/**
 * Godot's `Vector3::octahedron_tangent_decode` (`vector3.cpp:124-131`): the upper half of V is a
 * positive binormal sign and the lower half a negative one, each folded back onto [0, 1].
 */
function writeOctahedralTangent([u, v]: [number, number], tangents: Float32Array, vertex: number): void {
  const signed = v * 2 - 1;
  tangents.set([...octahedronDecode(u, Math.abs(signed)), signed >= 0 ? 1 : -1], vertex * 4);
}

/**
 * Godot's `_get_tbn_from_axis_angle` (`rendering_server.cpp:338-346`): the normal is row 2 of
 * the rotation (`basis.cpp:840-868`) and the tangent row 0. A stored angle above the midpoint
 * carries a positive binormal sign, and its distance from the midpoint is the rotation in
 * half-turns.
 */
function writeAxisAngleFrame(
  [ax, ay, az]: [number, number, number],
  storedAngle: number,
  normals: Float32Array,
  tangents: Float32Array,
  vertex: number
): void {
  const angle = Math.abs(storedAngle * 2 - 1) * Math.PI;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const omc = 1 - cos;
  normals.set([omc * az * ax - sin * ay, omc * az * ay + sin * ax, omc * az * az + cos], vertex * 3);
  tangents.set(
    [ax * ax * omc + cos, ax * ay * omc - az * sin, ax * az * omc + ay * sin, storedAngle > 0.5 ? 1 : -1],
    vertex * 4
  );
}

/**
 * The indices of `index_data`, uint16 for a mesh of at most 65535 vertices and uint32 otherwise,
 * which the byte length tells apart. Undefined when `index_data` is too short for the count it
 * declares, so the surface is dropped like any other unreadable one instead of throwing.
 */
export function decodeIndices(bytes: Uint8Array, indexCount: number): Uint32Array | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = bytes.byteLength >= indexCount * 4 ? 4 : 2;
  if (bytes.byteLength < indexCount * width) return undefined;
  const read =
    width === 4 ? (i: number) => view.getUint32(i * 4, true) : (i: number) => view.getUint16(i * 2, true);
  const out = new Uint32Array(indexCount);
  for (let i = 0; i < indexCount; i++) out[i] = read(i);
  return out;
}
