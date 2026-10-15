/** Godot's gradient textures: the size their setters accept. */

/**
 * The largest axis a gradient texture's size setters accept. `GradientTexture2D::set_width` and
 * `set_height` refuse outside 1 to 16384 with `ERR_FAIL_COND_MSG` (`gradient_texture.cpp:324`,
 * `:335`), as `GradientTexture1D::set_width` does (`:144`).
 */
export const GRADIENT_TEXTURE_MAX_SIZE = 16384;
