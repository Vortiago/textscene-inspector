/** Which image formats the rendering device gives an sRGB view. */

/**
 * The `Image::format_names` entries (`core/io/image.cpp:41-89`) the rendering device gives an sRGB
 * format, and so an sRGB view (`texture_storage.cpp:895-902`): RGB8 and RGBA8 (`:1874-1893`) and
 * the block formats with an sRGB variant (`:1997-2325`). Every other format, L8 and the float
 * formats among them (`:1846-1873`, `:1899-1996`), has only its raw view.
 */
const FORMATS_WITH_SRGB_VIEW: ReadonlySet<string> = new Set([
  'RGB8',
  'RGBA8',
  'DXT1 RGB8',
  'DXT3 RGBA8',
  'DXT5 RGBA8',
  'BPTC_RGBA',
  'ETC',
  'ETC2_RGB8',
  'ETC2_RGBA8',
  'ETC2_RGB8A1',
  'ETC2_RA_AS_RG',
  'FORMAT_DXT5_RA_AS_RG',
  'ASTC_4x4',
  'ASTC_8x8',
]);

/**
 * Whether a texture saved in `format`, an `Image::format_names` entry, has an sRGB view. A
 * `source_color` sampler reads that view only when it exists (`material_storage.cpp:1073`).
 */
export function formatHasSrgbView(format: string): boolean {
  return FORMATS_WITH_SRGB_VIEW.has(format);
}
