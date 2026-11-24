import { halfToFloat } from '../../../godot/math/halfFloat.js';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';
import { ArrayCustomFormat } from '../../../godot/rendering/meshArrayFormat.js';
import type { CustomArraySlot, SurfaceLayout } from './surfaceFormat.js';

/** A vertex format with fewer lanes than four reads 0 for a missing lane and 1 for a missing alpha. */
const MISSING_LANES = [0, 0, 0, 1] as const;

/** How the vertex stage reads each lane of a custom format: its lanes, and the value at a byte offset. */
interface CustomRead {
  lanes: number;
  laneBytes: number;
  lane: (view: DataView, offset: number) => number;
}

/** The vertex format Godot binds for each custom format (`mesh_storage.cpp:1382`). */
const CUSTOM_READS: Readonly<Record<EnumValue<typeof ArrayCustomFormat>, CustomRead>> = {
  [ArrayCustomFormat.RGBA8_UNORM]: { lanes: 4, laneBytes: 1, lane: (view, o) => view.getUint8(o) / 255 },
  [ArrayCustomFormat.RGBA8_SNORM]: {
    lanes: 4,
    laneBytes: 1,
    lane: (view, o) => Math.max(view.getInt8(o) / 127, -1),
  },
  [ArrayCustomFormat.RG_HALF]: {
    lanes: 2,
    laneBytes: 2,
    lane: (view, o) => halfToFloat(view.getUint16(o, true)),
  },
  [ArrayCustomFormat.RGBA_HALF]: {
    lanes: 4,
    laneBytes: 2,
    lane: (view, o) => halfToFloat(view.getUint16(o, true)),
  },
  [ArrayCustomFormat.R_FLOAT]: { lanes: 1, laneBytes: 4, lane: (view, o) => view.getFloat32(o, true) },
  [ArrayCustomFormat.RG_FLOAT]: { lanes: 2, laneBytes: 4, lane: (view, o) => view.getFloat32(o, true) },
  [ArrayCustomFormat.RGB_FLOAT]: { lanes: 3, laneBytes: 4, lane: (view, o) => view.getFloat32(o, true) },
  [ArrayCustomFormat.RGBA_FLOAT]: { lanes: 4, laneBytes: 4, lane: (view, o) => view.getFloat32(o, true) },
};

/** Four lanes for each vertex, each undefined when absent or when `attribute_data` is too narrow. */
export function decodeCustomArrays(
  bytes: Uint8Array,
  vertexCount: number,
  layout: SurfaceLayout
): (Float32Array | undefined)[] {
  const attributeStride = vertexCount > 0 ? bytes.byteLength / vertexCount : 0;
  const isReadable = Number.isInteger(attributeStride) && attributeStride >= layout.attributeStride;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return layout.customs.map((slot) =>
    slot && isReadable && vertexCount > 0 ? customValues(view, vertexCount, attributeStride, slot) : undefined
  );
}

function customValues(
  view: DataView,
  vertexCount: number,
  attributeStride: number,
  slot: CustomArraySlot
): Float32Array {
  const { lanes, laneBytes, lane } = CUSTOM_READS[slot.format];
  const values = new Float32Array(vertexCount * 4);
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    const record = vertex * attributeStride + slot.offset;
    for (let index = 0; index < 4; index++)
      values[vertex * 4 + index] =
        index < lanes ? lane(view, record + index * laneBytes) : MISSING_LANES[index]!;
  }
  return values;
}
