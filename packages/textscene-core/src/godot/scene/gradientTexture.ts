/** Godot 4.6.3's Gradient and gradient texture facts a scene's properties carry. */

/**
 * The largest axis a gradient texture's size setters accept. `GradientTexture2D::set_width` and
 * `set_height` refuse outside 1 to 16384 with `ERR_FAIL_COND_MSG` (`gradient_texture.cpp:324`,
 * `:335`), as `GradientTexture1D::set_width` does (`:144`).
 */
export const GRADIENT_TEXTURE_MAX_SIZE = 16384;

/** `Gradient::InterpolationMode` (`scene/resources/gradient.h:42-46`), each member without `GRADIENT_INTERPOLATE_`. */
export const GradientInterpolationMode = {
  LINEAR: 0,
  CONSTANT: 1,
  CUBIC: 2,
} as const;

/** `GradientTexture2D::Fill` (`scene/resources/gradient_texture.h:77-81`), each member without `FILL_`. */
export const GradientTexture2DFill = {
  LINEAR: 0,
  RADIAL: 1,
  SQUARE: 2,
} as const;

/** `GradientTexture2D::Repeat` (`gradient_texture.h:82-86`), as `REPEAT_NONE`, `REPEAT` and `REPEAT_MIRROR`. */
export const GradientTexture2DRepeat = {
  NONE: 0,
  REPEAT: 1,
  MIRROR: 2,
} as const;
