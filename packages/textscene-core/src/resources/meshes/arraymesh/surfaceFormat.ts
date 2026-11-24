import type { EnumValue } from '../../../godot/classdb/enumNames.js';
import type { ArrayCustomFormat } from '../../../godot/rendering/meshArrayFormat.js';

/**
 * A surface's byte geometry, derived from its Godot `format` bitfield.
 * `vertex_data` is two concatenated regions, not one interleaved record: the
 * positions, then the normal/tangent frame. `attribute_data` is a third,
 * interleaved COLOR, UV1, UV2 and CUSTOM0 to CUSTOM3.
 */

/** Godot Mesh.ArrayFormat flags. */
export const ARRAY_FORMAT_VERTEX = 1 << 0;
export const ARRAY_FORMAT_NORMAL = 1 << 1;
export const ARRAY_FORMAT_TANGENT = 1 << 2;
const ARRAY_FORMAT_COLOR = 1 << 3;
const ARRAY_FORMAT_TEX_UV = 1 << 4;
const ARRAY_FORMAT_TEX_UV2 = 1 << 5;
/** `ARRAY_FORMAT_CUSTOM0`: CUSTOM1 to CUSTOM3 follow it (`rendering_server.h:319`). */
const ARRAY_FORMAT_CUSTOM0 = 1 << 6;
const ARRAY_FORMAT_BONES = 1 << 10;
const ARRAY_FORMAT_WEIGHTS = 1 << 11;
/** Each custom array's format is 3 bits from bit 13, CUSTOM0 first (`rendering_server.h:329-335`). */
const ARRAY_FORMAT_CUSTOM_BASE = 13;
const ARRAY_FORMAT_CUSTOM_BITS = 3;
const ARRAY_FORMAT_CUSTOM_MASK = 0x7;
/** Eight bones and weights for each vertex, not four (`rendering_server.h:341`). */
const ARRAY_FLAG_USE_8_BONE_WEIGHTS = 1 << 27;
/** Positions are 2×float32, not 3 (`rendering_server.h:339`). */
export const ARRAY_FLAG_USE_2D_VERTICES = 1 << 25;
/**
 * Attributes are quantised. `&` coerces to int32, so it reads only bits below 32, never
 * `ARRAY_FLAG_FORMAT_VERSION_2` (1 << 35): `surfaceVersion.ts` reads the version and upgrades an
 * older surface first.
 */
const ARRAY_FLAG_COMPRESS_ATTRIBUTES = 1 << 29;

/** RGBA8 vertex colour in both layouts, which Godot writes before UV1 in the attribute record. */
export const COLOR_BYTES = 4;

/** Bytes of one vertex's element in each custom format, by format (`rendering_server.cpp:1102-1132`). */
const CUSTOM_ELEMENT_BYTES: readonly number[] = [4, 4, 4, 8, 4, 8, 12, 16];

/** `ARRAY_CUSTOM_COUNT` (`rendering_server.h:296`). */
export const CUSTOM_ARRAY_COUNT = 4;

/** One custom array of a surface: its format and its byte offset in each attribute record. */
export interface CustomArraySlot {
  format: EnumValue<typeof ArrayCustomFormat>;
  offset: number;
}

/** A surface's `skin_data`: bone indices, then weights, each `count` uint16s for every vertex. */
export interface SkinLayout {
  count: 4 | 8;
  /** Bytes of one vertex's record: the indices and the weights. */
  stride: number;
}

/**
 * Godot `Mesh.PrimitiveType` (`servers/rendering_server.h`: POINTS 0, LINES 1, LINE_STRIP 2,
 * TRIANGLES 3, TRIANGLE_STRIP 4). Any other value reads no way, and a LINES surface read as
 * triangles fabricates faces.
 */
export const PRIMITIVE_POINTS = 0;
export const PRIMITIVE_LINES = 1;
export const PRIMITIVE_LINE_STRIP = 2;
export const PRIMITIVE_TRIANGLES = 3;
export const PRIMITIVE_TRIANGLE_STRIP = 4;

/**
 * Byte geometry of one surface's buffers, mirroring Godot's
 * `RenderingServer::mesh_surface_make_offsets_from_format`. Every byte size is
 * decided here, so a format combination is described once.
 */
export interface SurfaceLayout {
  compressed: boolean;
  /** Positions are 2×float32, whatever the compression (`rendering_server.cpp:1079-1084`). */
  isPosition2D: boolean;
  /**
   * How the normal region stores the tangent. `frame`: compression folds it into the normal's
   * bytes as an axis-angle frame. `octahedral`: its own 2×uint16 after each normal. `none`: the
   * surface declares no TANGENT, or no NORMAL to carry it.
   */
  tangent: 'frame' | 'octahedral' | 'none';
  /** Bytes per vertex in `vertex_data`'s leading position region. */
  positionStride: number;
  /** Bytes per vertex in the normal/tangent region: both halved when compressed. */
  normalStride: number;
  /** Bytes per vertex in `attribute_data`, from the format, never derived. */
  attributeStride: number;
  /** Whether each attribute record starts with an RGBA8 vertex colour. */
  hasColor: boolean;
  /** Byte offset of UV1 within one attribute record, or -1 when the surface has none. */
  uvOffset: number;
  /** Byte offset of UV2 within one attribute record, or -1 when the surface has none. */
  uv2Offset: number;
  /** CUSTOM0 to CUSTOM3 in order, each undefined when the surface has none. */
  customs: readonly (CustomArraySlot | undefined)[];
  /** The bone indices and weights in `skin_data`, or undefined when the surface has neither. */
  skin?: SkinLayout;
}

/**
 * A compressed 2D position record has no angle slot to carry a frame, so its normal is the
 * octahedral axis alone (`rendering_server.cpp:1500-1506`).
 */
function tangentStorage(format: {
  compressed: boolean;
  isPosition2D: boolean;
  hasNormal: boolean;
  hasTangent: boolean;
}): SurfaceLayout['tangent'] {
  if (!format.hasNormal || !format.hasTangent) return 'none';
  if (!format.compressed) return 'octahedral';
  return format.isPosition2D ? 'none' : 'frame';
}

export function surfaceLayout(format: number): SurfaceLayout {
  const compressed = (format & ARRAY_FLAG_COMPRESS_ATTRIBUTES) !== 0;
  const isPosition2D = (format & ARRAY_FLAG_USE_2D_VERTICES) !== 0;
  const hasNormal = (format & ARRAY_FORMAT_NORMAL) !== 0;
  const hasTangent = (format & ARRAY_FORMAT_TANGENT) !== 0;
  const hasColor = (format & ARRAY_FORMAT_COLOR) !== 0;
  const hasUV = (format & ARRAY_FORMAT_TEX_UV) !== 0;
  const hasUV2 = (format & ARRAY_FORMAT_TEX_UV2) !== 0;

  // 2D: 2×float32. Else compressed: 3×uint16 spanning the surface `aabb`, plus the tangent-frame
  // angle. Else 3×float32.
  const positionStride = isPosition2D || compressed ? 8 : 12;
  // Each octahedral pair is 2×uint16. Compressed folds the tangent into the
  // normal's 4 bytes as an axis-angle frame. Uncompressed gives each pair its own 4.
  const normalStride = hasNormal ? (compressed ? 4 : 4 + (hasTangent ? 4 : 0)) : 0;
  // 2×uint16 re-expanded by a non-zero `uv_scale` when compressed, else 2×float32.
  const uvBytes = compressed ? 4 : 8;
  const uvsEnd = (hasColor ? COLOR_BYTES : 0) + (hasUV ? uvBytes : 0) + (hasUV2 ? uvBytes : 0);
  const { customs, attributeStride } = customSlots(format, uvsEnd);

  return {
    compressed,
    isPosition2D,
    tangent: tangentStorage({ compressed, isPosition2D, hasNormal, hasTangent }),
    positionStride,
    normalStride,
    attributeStride,
    hasColor,
    uvOffset: hasUV ? (hasColor ? COLOR_BYTES : 0) : -1,
    uv2Offset: hasUV2 ? (hasColor ? COLOR_BYTES : 0) + (hasUV ? uvBytes : 0) : -1,
    customs,
    ...skinLayout(format),
  };
}

/** The custom arrays after the UVs of each attribute record, in order, and the record's whole width. */
function customSlots(
  format: number,
  firstOffset: number
): { customs: (CustomArraySlot | undefined)[]; attributeStride: number } {
  const customs: (CustomArraySlot | undefined)[] = [];
  let offset = firstOffset;
  for (let custom = 0; custom < CUSTOM_ARRAY_COUNT; custom++) {
    if (!(format & (ARRAY_FORMAT_CUSTOM0 << custom))) {
      customs.push(undefined);
      continue;
    }
    const shift = ARRAY_FORMAT_CUSTOM_BASE + custom * ARRAY_FORMAT_CUSTOM_BITS;
    const customFormat = (format >>> shift) & ARRAY_FORMAT_CUSTOM_MASK;
    customs.push({ format: customFormat as EnumValue<typeof ArrayCustomFormat>, offset });
    offset += CUSTOM_ELEMENT_BYTES[customFormat]!;
  }
  return { customs, attributeStride: offset };
}

/** Godot saves bones and weights together, each 2 bytes an element (`rendering_server.cpp:1134-1142`). */
function skinLayout(format: number): { skin?: SkinLayout } {
  if (!(format & ARRAY_FORMAT_BONES) || !(format & ARRAY_FORMAT_WEIGHTS)) return {};
  const count = format & ARRAY_FLAG_USE_8_BONE_WEIGHTS ? 8 : 4;
  return { skin: { count, stride: count * 2 * 2 } };
}
