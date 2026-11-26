import { halfToFloat } from '../../../godot/math/halfFloat.js';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';
import {
  ArrayCustomFormat,
  CUSTOM_FORMAT_LANES,
  fourCustomLanes,
} from '../../../godot/rendering/meshArrayFormat.js';
import type { CustomArraySlot, SurfaceLayout } from './surfaceFormat.js';
import type { AttributeRecords } from './vertexBuffers.js';

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

/** Four lanes for each vertex, each undefined when the surface has none or no readable records. */
export function decodeCustomArrays(
  records: AttributeRecords | undefined,
  layout: SurfaceLayout
): (Float32Array | undefined)[] {
  return layout.customs.map((slot) => slot && records && customValues(records, slot));
}

function customValues(
  { view, vertexCount, attributeStride }: AttributeRecords,
  slot: CustomArraySlot
): Float32Array {
  const { lanes, laneBytes } = CUSTOM_FORMAT_LANES[slot.format]!;
  const lane = LANE_READS[slot.format];
  return fourCustomLanes(vertexCount, lanes, (vertex, index) =>
    lane(view, vertex * attributeStride + slot.offset + index * laneBytes)
  );
}
