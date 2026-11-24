import { halfToFloat } from '../../../godot/math/halfFloat.js';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';
import { ArrayCustomFormat, CUSTOM_FORMAT_LANES } from '../../../godot/rendering/meshArrayFormat.js';
import { bytesView } from '../../../utils/bytesView.js';
import type { CustomArraySlot, SurfaceLayout } from './surfaceFormat.js';

/** A vertex format with fewer lanes than four reads 0 for a missing lane and 1 for a missing alpha. */
const MISSING_LANES = [0, 0, 0, 1] as const;

const readUnorm8 = (view: DataView, offset: number) => view.getUint8(offset) / 255;
const readSnorm8 = (view: DataView, offset: number) => Math.max(view.getInt8(offset) / 127, -1);
const readHalf = (view: DataView, offset: number) => halfToFloat(view.getUint16(offset, true));
const readFloat = (view: DataView, offset: number) => view.getFloat32(offset, true);

/** The vertex format Godot binds for each custom format (`mesh_storage.cpp:1382`). */
const LANE_READS: Readonly<
  Record<EnumValue<typeof ArrayCustomFormat>, (view: DataView, offset: number) => number>
> = {
  [ArrayCustomFormat.RGBA8_UNORM]: readUnorm8,
  [ArrayCustomFormat.RGBA8_SNORM]: readSnorm8,
  [ArrayCustomFormat.RG_HALF]: readHalf,
  [ArrayCustomFormat.RGBA_HALF]: readHalf,
  [ArrayCustomFormat.R_FLOAT]: readFloat,
  [ArrayCustomFormat.RG_FLOAT]: readFloat,
  [ArrayCustomFormat.RGB_FLOAT]: readFloat,
  [ArrayCustomFormat.RGBA_FLOAT]: readFloat,
};

/** Four lanes for each vertex, each undefined when absent or when `attribute_data` is too narrow. */
export function decodeCustomArrays(
  bytes: Uint8Array,
  vertexCount: number,
  layout: SurfaceLayout
): (Float32Array | undefined)[] {
  const attributeStride = vertexCount > 0 ? bytes.byteLength / vertexCount : 0;
  const isReadable = Number.isInteger(attributeStride) && attributeStride >= layout.attributeStride;
  const view = bytesView(bytes);
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
  const { lanes, laneBytes } = CUSTOM_FORMAT_LANES[slot.format]!;
  const lane = LANE_READS[slot.format];
  const values = new Float32Array(vertexCount * 4);
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    const record = vertex * attributeStride + slot.offset;
    for (let index = 0; index < lanes; index++)
      values[vertex * 4 + index] = lane(view, record + index * laneBytes);
    for (let index = lanes; index < 4; index++) values[vertex * 4 + index] = MISSING_LANES[index]!;
  }
  return values;
}
