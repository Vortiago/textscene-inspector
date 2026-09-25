/**
 * A surface's byte geometry, derived from its Godot `format` bitfield.
 * `vertex_data` is two concatenated regions, not one interleaved record: the
 * positions, then the normal/tangent frame. `attribute_data` is a third,
 * interleaved COLOR, UV1, UV2.
 */

/** Godot Mesh.ArrayFormat flags. */
const ARRAY_FORMAT_NORMAL = 1 << 1;
const ARRAY_FORMAT_TANGENT = 1 << 2;
const ARRAY_FORMAT_COLOR = 1 << 3;
const ARRAY_FORMAT_TEX_UV = 1 << 4;
const ARRAY_FORMAT_TEX_UV2 = 1 << 5;
/**
 * Attributes are quantised. `&` coerces to int32, so it reads only bits below 32,
 * never `ARRAY_FLAG_FORMAT_VERSION_2` (1 << 35). Nothing here reads that flag:
 * bit 29 alone selects the layout, so a fixture can omit the version flag.
 */
const ARRAY_FLAG_COMPRESS_ATTRIBUTES = 1 << 29;

/** RGBA8 vertex colour in both layouts, which Godot writes before UV1 in the attribute record. */
const COLOR_BYTES = 4;

/**
 * Godot `Mesh.PrimitiveType.PRIMITIVE_TRIANGLES` (`servers/rendering_server.h`:
 * POINTS 0, LINES 1, LINE_STRIP 2, TRIANGLES 3, TRIANGLE_STRIP 4), the only one
 * this decoder reads. Any other read as triangles fabricates faces.
 */
export const PRIMITIVE_TRIANGLES = 3;

/**
 * Byte geometry of one surface's buffers, mirroring Godot's
 * `RenderingServer::mesh_surface_make_offsets_from_format`. Every byte size is
 * decided here, so a format combination is described once.
 */
export interface SurfaceLayout {
  compressed: boolean;
  /**
   * The normal region holds an axis-angle tangent frame rather than a plain
   * octahedral normal. Compression folds the tangent into the normal's bytes,
   * so this is true only when the surface declares a TANGENT.
   */
  tangentFrame: boolean;
  /** Bytes per vertex in `vertex_data`'s leading position region. */
  positionStride: number;
  /** Bytes per vertex in the normal/tangent region: both halved when compressed. */
  normalStride: number;
  /** Bytes per vertex in `attribute_data`, from the format, never derived. */
  attributeStride: number;
  /** Byte offset of UV1 within one attribute record, or -1 when the surface has none. */
  uvOffset: number;
}

export function surfaceLayout(format: number): SurfaceLayout {
  const compressed = (format & ARRAY_FLAG_COMPRESS_ATTRIBUTES) !== 0;
  const hasNormal = (format & ARRAY_FORMAT_NORMAL) !== 0;
  const hasTangent = (format & ARRAY_FORMAT_TANGENT) !== 0;
  const hasColor = (format & ARRAY_FORMAT_COLOR) !== 0;
  const hasUV = (format & ARRAY_FORMAT_TEX_UV) !== 0;
  const hasUV2 = (format & ARRAY_FORMAT_TEX_UV2) !== 0;

  // Compressed: 3×uint16 spanning the surface `aabb`, plus the tangent-frame
  // angle. Uncompressed: 3×float32.
  const positionStride = compressed ? 8 : 12;
  // Each octahedral pair is 2×uint16. Compressed folds the tangent into the
  // normal's 4 bytes as an axis-angle frame. Uncompressed gives each pair its own 4.
  const normalStride = hasNormal ? (compressed ? 4 : 4 + (hasTangent ? 4 : 0)) : 0;
  // 2×uint16 re-expanded by a non-zero `uv_scale` when compressed, else 2×float32.
  const uvBytes = compressed ? 4 : 8;

  return {
    compressed,
    tangentFrame: compressed && hasTangent,
    positionStride,
    normalStride,
    attributeStride:
      (hasColor ? COLOR_BYTES : 0) + (hasUV ? uvBytes : 0) + (hasUV2 ? uvBytes : 0),
    uvOffset: hasUV ? (hasColor ? COLOR_BYTES : 0) : -1,
  };
}
