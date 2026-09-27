/**
 * The sRGB transfer function both ways, in one place. Godot authors every material colour in sRGB
 * and converts on upload, so albedo and emission share one curve. A colour that goes to linear and
 * back lands on the byte it left only while the two halves stay exact inverses.
 */

/**
 * Godot's `Color::srgb_to_linear` (`core/math/color.h:192-198`) for one channel, unclamped: Godot's
 * HDR picker writes channels above 1, and the extrapolating `pow` keeps an HDR emission colour
 * bright enough to cross the glow bright-pass.
 */
export function sRGBChannelToLinear(c: number): number {
  if (c < 0.04045) return c / 12.92;
  return Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Godot's `Color::linear_to_srgb` (`core/math/color.h:199-204`) for one channel, unclamped: the
 * inverse of {@link sRGBChannelToLinear}, so an HDR channel above 1 stays above 1.
 */
export function linearChannelToSRGB(c: number): number {
  if (c < 0.0031308) return 12.92 * c;
  return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** `sRGBChannelToLinear` over an RGB triple. */
export function sRGBToLinearRGB(r: number, g: number, b: number): [number, number, number] {
  return [sRGBChannelToLinear(r), sRGBChannelToLinear(g), sRGBChannelToLinear(b)];
}

/**
 * Godot's `Color::get_r8()`: a 0..1 channel rounded to 8 bit, clamped to
 * 0..255. The rounding rule has to match Godot's exactly wherever pixels are
 * compared against the engine's, so it lives here rather than per rasteriser.
 */
export function channelToByte(channel: number): number {
  return Math.min(255, Math.max(0, Math.round(channel * 255)));
}
