/**
 * NoiseTexture3D slice types. Defaults are Godot's (`modules/noise/noise_texture_3d.h:52-58`).
 * `noise` and `color_ramp` stay raw refs: the decode does not take the owning file's sub-resource
 * table.
 */

export interface NoiseTexture3DData {
  width: number;
  height: number;
  depth: number;
  invert: boolean;
  /** Rescale the field to its own min/max over the whole volume before writing. */
  normalize: boolean;
  seamless: boolean;
  /** Fraction of each axis generated as an overlap to blend the seams over. */
  seamlessBlendSkirt: number;
  /** Raw `noise` ref: a `SubResource` naming a Noise resource, or null. */
  noise: string | null;
  /** Raw `color_ramp` ref: a `SubResource` naming a Gradient, or null. */
  colorRamp: string | null;
}
