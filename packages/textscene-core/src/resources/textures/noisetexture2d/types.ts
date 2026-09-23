/**
 * NoiseTexture2D slice types. Defaults are Godot's (`modules/noise/noise_texture_2d.h:47-62`,
 * `size = Size2i(512, 512)` at line 54). `noise` and `color_ramp` stay raw refs:
 * the decode does not take the owning file's sub-resource table.
 */

export interface NoiseTexture2DData {
  width: number;
  height: number;
  invert: boolean;
  /** Rescale the image to its own min/max before writing (Godot default true). */
  normalize: boolean;
  seamless: boolean;
  /** Fraction of the size generated as an overlap to blend the seam over. */
  seamlessBlendSkirt: number;
  asNormalMap: boolean;
  bumpStrength: number;
  /** Raw `noise` ref: a `SubResource` naming a Noise resource, or null. */
  noise: string | null;
  /** Raw `color_ramp` ref: a `SubResource` naming a Gradient, or null. */
  colorRamp: string | null;
}
