/**
 * The upgrade of a surface Godot saved before format version 2, as
 * `RenderingServer::fix_surface_compatibility` runs it on load (`servers/rendering/rendering_server.cpp:2222-2290`,
 * called from `scene/resources/mesh.cpp:1662-1664`). Version 1 interleaves each vertex's position,
 * normal and tangent. Version 2 stores every position first, then the normal and tangent pairs.
 */

import {
  ARRAY_FLAG_USE_2D_VERTICES,
  ARRAY_FORMAT_NORMAL,
  ARRAY_FORMAT_TANGENT,
  ARRAY_FORMAT_VERTEX,
} from './surfaceFormat.js';

/** `rendering_server.h:348-354`: an 8-bit version field at bit 35, which holds 1 for version 2. */
const FORMAT_VERSION_UNIT = 2 ** 35;
const FORMAT_VERSION_MASK = 0xff;
const FORMAT_VERSION_1 = 0;
const FORMAT_CURRENT_VERSION = 1;

/** An octahedral normal or tangent: 2×uint16, in both versions (`:2251-2256`). */
const FRAME_PAIR_BYTES = 4;

/**
 * The surface's `vertex_data` in the current layout. Godot refuses a version above its own, and
 * the whole mesh fails to load (`mesh.cpp:1665-1668`), so this throws.
 */
export function currentVertexData(format: number, vertexData: Uint8Array, vertexCount: number): Uint8Array {
  const version = Math.floor(format / FORMAT_VERSION_UNIT) & FORMAT_VERSION_MASK;
  if (version > FORMAT_CURRENT_VERSION) {
    throw new Error(
      `expected a surface format version field up to ${FORMAT_CURRENT_VERSION}, got ${version}`
    );
  }
  if (version !== FORMAT_VERSION_1 || vertexData.byteLength === 0 || vertexCount === 0) return vertexData;
  return regionsFromInterleaved(format, vertexData, vertexCount);
}

/** `_convert_surface_version_1_to_surface_version_2` (`:2156-2208`): PNTPNT becomes PPNTNT. */
function regionsFromInterleaved(format: number, interleaved: Uint8Array, vertexCount: number): Uint8Array {
  // Not `surfaceLayout`: a version 1 surface has no compressed form, and the conversion sizes a 2D
  // position and a missing attribute itself.
  const positionSize = !(format & ARRAY_FORMAT_VERTEX) ? 0 : format & ARRAY_FLAG_USE_2D_VERTICES ? 8 : 12;
  const frameSize =
    (format & ARRAY_FORMAT_NORMAL ? FRAME_PAIR_BYTES : 0) +
    (format & ARRAY_FORMAT_TANGENT ? FRAME_PAIR_BYTES : 0);
  const recordSize = Math.floor(interleaved.byteLength / vertexCount);
  // Godot reads past a short record. The decoder drops the surface instead, so it stays as it is.
  if (recordSize < positionSize + frameSize) return interleaved;
  const framesStart = positionSize * vertexCount;
  const regions = new Uint8Array(interleaved.byteLength);
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    const record = vertex * recordSize;
    regions.set(interleaved.subarray(record, record + positionSize), vertex * positionSize);
    regions.set(
      interleaved.subarray(record + positionSize, record + positionSize + frameSize),
      framesStart + vertex * frameSize
    );
  }
  return regions;
}
