/**
 * Godot's sRGB transfer functions as GLSL, matching `linear_to_srgb` and `srgb_to_linear` in
 * `tonemap.glsl:235-243` and three's `sRGBTransferOETF` and `sRGBTransferEOTF`. The 2D light pass
 * and the tone-map adjustments concatenate this one text: a second copy that drifted would put a
 * gamma error on every pixel it touches.
 */

/** Linear → sRGB, the OETF. */
export const GODOT_TO_SRGB_GLSL = /* glsl */ `
vec3 godotToSrgb(vec3 c) {
  return mix(c * 12.92, pow(max(c, vec3(0.0)), vec3(0.41666)) * 1.055 - 0.055, step(0.0031308, c));
}
`;

/** sRGB → linear, the EOTF. */
export const GODOT_TO_LINEAR_GLSL = /* glsl */ `
vec3 godotToLinear(vec3 c) {
  return mix(c / 12.92, pow((max(c, vec3(0.0)) + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
`;
