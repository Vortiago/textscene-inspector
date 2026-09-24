/**
 * Reads a surface's `vertex_data`, `attribute_data` and `index_data` into typed
 * arrays holding what Godot's `ArrayMesh.surface_get_arrays()` returns, so
 * dequantising through `aabb` / `uv_scale` belongs here. The conversions to
 * three.js (V flip, triangle winding) live in `build.ts`.
 */

import type { SurfaceAabb } from './surfaceFields.js';
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

/**
 * UV1 from `attribute_data`, or undefined when the record is narrower than the
 * format implies: wrong UVs are worse than none. Compressed UV1 is 2×uint16 over
 * the unit range. A non-zero `uv_scale` is the divisor Godot normalised
 * out-of-range UVs by, so the value is re-expanded around 0.5.
 */
export function decodeUVs(
  bytes: Uint8Array,
  vertexCount: number,
  layout: SurfaceLayout,
  uvScale: [number, number] | undefined,
  onMismatch: (actualStride: number) => void
): Float32Array | undefined {
  const { uvOffset } = layout;
  if (uvOffset < 0 || vertexCount === 0 || bytes.byteLength === 0) return undefined;

  // Godot orders the record COLOR, UV1, UV2, CUSTOM0..3, so vertex colours put 4
  // RGBA8 bytes ahead of UV1 and a wider record (an unmodelled CUSTOM channel)
  // reads fine at its stride. A record too narrow or not dividing evenly puts
  // UV1 somewhere else, so the UVs go.
  const actualStride = bytes.byteLength / vertexCount;
  if (!Number.isInteger(actualStride) || actualStride < layout.attributeStride) {
    onMismatch(actualStride);
    return undefined;
  }
  const attributeStride = actualStride;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Float32Array(vertexCount * 2);

  if (!layout.compressed) {
    for (let i = 0; i < vertexCount; i++) {
      const o = i * attributeStride + uvOffset;
      out[i * 2] = view.getFloat32(o, true);
      out[i * 2 + 1] = view.getFloat32(o + 4, true);
    }
    return out;
  }

  // A zero `uv_scale` means the stored value already is the UV. Otherwise Godot
  // normalised UVs that left the unit range into the uint16 range against that
  // divisor, so they re-expand around 0.5.
  const [scaleU, scaleV] = uvScale ?? [0, 0];
  const rescale = scaleU !== 0 || scaleV !== 0;
  for (let i = 0; i < vertexCount; i++) {
    const o = i * attributeStride + uvOffset;
    const u = view.getUint16(o, true) / 65535;
    const v = view.getUint16(o + 2, true) / 65535;
    out[i * 2] = rescale ? (u - 0.5) * scaleU : u;
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
 * Normals from the region after the positions, or undefined when there is none,
 * so the caller recomputes. Uncompressed stores a 2×uint16 octahedral normal.
 * Compressed stores a rotation axis there and the angle (half-turns) in the 4th
 * uint16 of the position record: the normal is row 3 of `axis_angle_to_tbn`.
 */
export function decodeNormals(
  bytes: Uint8Array,
  vertexCount: number,
  layout: SurfaceLayout
): Float32Array | undefined {
  const { normalStride: stride, positionStride } = layout;
  if (stride === 0 || vertexCount === 0) return undefined;
  const normalBlock = vertexCount * positionStride;
  if (bytes.byteLength < normalBlock + stride * vertexCount) return undefined;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Float32Array(vertexCount * 3);
  // uint16 → [-1, 1] octahedral coordinates. What that pair MEANS is the whole
  // difference between the two layouts, so they get a loop each rather than a
  // per-vertex test of something that cannot change.
  const oct = (o: number): [number, number] => [
    (view.getUint16(o, true) / 65535) * 2 - 1,
    (view.getUint16(o + 2, true) / 65535) * 2 - 1,
  ];

  if (!layout.tangentFrame) {
    for (let i = 0; i < vertexCount; i++) {
      const [ex, ey] = oct(normalBlock + i * stride);
      const [nx, ny, nz] = octToVec3(ex, ey);
      out[i * 3] = nx;
      out[i * 3 + 1] = ny;
      out[i * 3 + 2] = nz;
    }
    return out;
  }

  for (let i = 0; i < vertexCount; i++) {
    // The pair is a rotation AXIS, and the ANGLE is the 4th uint16 of the
    // position record, in half-turns. The normal is the third row of that
    // rotation (Godot's `axis_angle_to_tbn`).
    const [ex, ey] = oct(normalBlock + i * stride);
    const [ax, ay, az] = octToVec3(ex, ey);
    // Absolute value, as Godot's `abs(angle * 2.0 - 1.0) * PI`: the sign carries
    // the binormal's handedness, not the rotation's direction. Read signed, it
    // flips the normal's x and y for every vertex below the midpoint.
    const angle = Math.abs((view.getUint16(i * positionStride + 6, true) / 65535) * 2 - 1) * Math.PI;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const omc = 1 - cos;
    const nx = omc * az * ax - sin * ay;
    const ny = omc * az * ay + sin * ax;
    const nz = omc * az * az + cos;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    out[i * 3] = nx / len;
    out[i * 3 + 1] = ny / len;
    out[i * 3 + 2] = nz / len;
  }
  return out;
}

/**
 * uint16 when ≤ 65535 vertices, uint32 otherwise, detected from byte width.
 * Undefined when `index_data` is too short for the count it declares, so the
 * surface is dropped like any other unreadable one rather than throwing a
 * RangeError that would take the whole mesh down.
 */
export function decodeIndices(
  bytes: Uint8Array,
  indexCount: number
): Uint16Array | Uint32Array | undefined {
  if (indexCount === 0) return new Uint16Array(0);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = bytes.byteLength >= indexCount * 4 ? 4 : 2;
  if (bytes.byteLength < indexCount * width) return undefined;
  if (width === 4) {
    const out = new Uint32Array(indexCount);
    for (let i = 0; i < indexCount; i++) out[i] = view.getUint32(i * 4, true);
    return out;
  }
  const out = new Uint16Array(indexCount);
  for (let i = 0; i < indexCount; i++) out[i] = view.getUint16(i * 2, true);
  return out;
}
