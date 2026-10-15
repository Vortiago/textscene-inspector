/**
 * Texture facts: Godot's Image pixel ceiling, the size bound of its gradient texture setters, and
 * which image formats the rendering device gives an sRGB view.
 */

/**
 * `Image::MAX_PIXELS` (`core/io/image.h:71`), 16384². `Image::initialize_data` refuses a larger
 * image with `ERR_FAIL_COND_MSG` (`core/io/image.cpp:2421`) and leaves it empty.
 */
export const IMAGE_MAX_PIXELS = 268435456;

/**
 * The largest axis a gradient texture's size setters accept. `GradientTexture2D::set_width` and
 * `set_height` refuse outside 1 to 16384 with `ERR_FAIL_COND_MSG` (`gradient_texture.cpp:324`,
 * `:335`), as `GradientTexture1D::set_width` does (`:144`).
 */
export const GRADIENT_TEXTURE_MAX_SIZE = 16384;

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
