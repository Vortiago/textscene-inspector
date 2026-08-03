/**
 * A surface's byte geometry, derived from its Godot `format` bitfield.
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
 */

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
 * Godot `Mesh.PrimitiveType.PRIMITIVE_TRIANGLES`
 * (`servers/rendering_server.h`: POINTS 0, LINES 1, LINE_STRIP 2, TRIANGLES 3,
 * TRIANGLE_STRIP 4). The only primitive this decoder reads: every other one
 * indexes its vertices under different rules, so reading it as triangles
 * fabricates faces that were never authored.
 */
export const PRIMITIVE_TRIANGLES = 3;

/**
 * Byte geometry of one surface's buffers, mirroring Godot's
 * `RenderingServer::mesh_surface_make_offsets_from_format`. The single place any
 * byte size is decided, so a format combination is described once.
 */
export interface SurfaceLayout {
  compressed: boolean;
  /**
   * The normal region holds an axis-angle tangent frame rather than a plain
   * octahedral normal. Compression folds the tangent INTO the normal's bytes,
   * so this is true only when the surface actually declares a TANGENT.
   */
  tangentFrame: boolean;
  /** Bytes per vertex in `vertex_data`'s leading position region. */
  positionStride: number;
  /** Bytes per vertex in the normal/tangent region: both halved when compressed. */
  normalStride: number;
  /** Bytes per vertex in `attribute_data`, from the format — never derived. */
  attributeStride: number;
  /** Byte offset of UV1 within one attribute record; -1 when the surface has none. */
  uvOffset: number;
}

export function surfaceLayout(format: number): SurfaceLayout {
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
    tangentFrame: compressed && hasTangent,
    positionStride,
    normalStride,
    attributeStride:
      (hasColor ? COLOR_BYTES : 0) + (hasUV ? uvBytes : 0) + (hasUV2 ? uvBytes : 0),
    uvOffset: hasUV ? (hasColor ? COLOR_BYTES : 0) : -1,
  };
}
