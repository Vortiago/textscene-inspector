/**
 * The sRGB transfer function, in one place.
 *
 * Godot authors every material colour in sRGB and converts on upload, so albedo
 * and emission both need the same curve — and needed it badly enough that having
 * two copies is how they drifted apart before.
 */

/**
 * Godot's `Color::srgb_to_linear` for a single channel.
 *
 * Deliberately NOT clamped. Godot's Color permits channels above 1 (its HDR
 * picker writes them), and the `pow` branch extrapolates rather than clipping —
 * which is what keeps an HDR emission colour bright enough to cross the glow
 * bright-pass. Clamping here would silently cap it.
 */
export function sRGBChannelToLinear(c: number): number {
  if (c <= 0.04045) return c / 12.92;
  return Math.pow((c + 0.055) / 1.055, 2.4);
}

/** `sRGBChannelToLinear` over an RGB triple. */
export function sRGBToLinearRGB(r: number, g: number, b: number): [number, number, number] {
  return [sRGBChannelToLinear(r), sRGBChannelToLinear(g), sRGBChannelToLinear(b)];
}
