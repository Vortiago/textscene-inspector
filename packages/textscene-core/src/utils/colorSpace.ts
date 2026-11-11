/**
 * The sRGB transfer function, in one place. Godot authors every material colour in sRGB and
 * converts on upload, so albedo and emission share one curve. The ColorPicker's normalisation goes
 * to linear and back in Godot's float steps, so that pair lands on the byte it left.
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

// Bound once: a colour picker converts each channel in several float steps per colour.
const { fround } = Math;

/**
 * {@link sRGBChannelToLinear} with the float rounding of each step that Godot's `float` maths
 * takes, for a result whose float noise Godot's own output shows.
 */
export function sRGBChannelToLinearF32(channel: number): number {
  const c = fround(channel);
  return c < fround(0.04045)
    ? fround(c * fround(1 / 12.92))
    : fround(Math.pow(fround((c + 0.055) * (1 / (1 + 0.055))), fround(2.4)));
}

/**
 * Godot's `Color::linear_to_srgb` (`core/math/color.h:199-204`) for one channel, unclamped and in
 * float steps: the inverse of {@link sRGBChannelToLinearF32}, so an HDR channel above 1 stays above 1.
 */
export function linearChannelToSRGBF32(channel: number): number {
  const c = fround(channel);
  return c < fround(0.0031308)
    ? fround(fround(12.92) * c)
    : fround((1 + 0.055) * fround(Math.pow(c, fround(1 / 2.4))) - 0.055);
}

/** `sRGBChannelToLinear` over an RGB triple. */
export function sRGBToLinearRGB(r: number, g: number, b: number): [number, number, number] {
  return [sRGBChannelToLinear(r), sRGBChannelToLinear(g), sRGBChannelToLinear(b)];
}

/**
 * Godot's `Color::get_r8()` (`core/math/color.h:228`): a 0..1 channel rounded to 8 bit, clamped
 * to 0..255. The product is a float, so 0.9 lands on 229.5 and rounds up, where a double gives
 * 229.49999 and rounds down. It lives here, not per rasteriser, since pixels are compared
 * against the engine's.
 */
export function channelToByte(channel: number): number {
  return Math.min(255, Math.max(0, Math.round(Math.fround(Math.fround(channel) * 255))));
}
