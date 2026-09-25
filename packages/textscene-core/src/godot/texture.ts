/** Texture size limits: Godot's Image pixel ceiling, and the size bound of its gradient texture setters. */

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
