/**
 * Godot's sRGB transfer functions as GLSL, shared by every shader in the 2D
 * light pass.
 *
 * The two halves of the pass are load-bearing on each other: a light quad emits
 * `light_color` already encoded to Godot's sRGB space, and the item injection
 * decodes its own fragment to that same space before multiplying the two. They
 * are correct only while they are the SAME curve. A divergence would not throw
 * and would not fail a type check — it would put a gamma error on every lit 2D
 * pixel, with nothing in the code pointing at the second copy. So the source
 * text lives once and both sides concatenate it.
 *
 * These match three's own `sRGBTransferOETF` / `sRGBTransferEOTF`.
 */

/** Linear → sRGB, the OETF. */
export const GODOT_TO_SRGB_GLSL = /* glsl */ `
vec3 godotToSrgb(vec3 c) {
  return mix(c * 12.92, pow(max(c, vec3(0.0)), vec3(0.41666)) * 1.055 - 0.055, step(0.0031308, c));
}
`;

/** sRGB → linear, the EOTF. Only the item side needs to go back. */
export const GODOT_TO_LINEAR_GLSL = /* glsl */ `
vec3 godotToLinear(vec3 c) {
  return mix(c / 12.92, pow((max(c, vec3(0.0)) + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
`;
