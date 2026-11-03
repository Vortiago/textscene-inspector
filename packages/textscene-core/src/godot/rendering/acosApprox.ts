/**
 * Godot's `acos_approx` as GLSL, Eberly's polynomial for `acos` on [-1, 1] (`sky.glsl:179-184`,
 * `area_lights_inc.glsl:6-11`). The sky's panorama coordinates and the area light's integral both
 * concatenate this one text.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

/**
 * `godotAcosApprox(x)` in [0, π]. Its literals are π/2 and π, as the radiance bake's program
 * defines no `PI`.
 */
export const GODOT_ACOS_APPROX_GLSL = /* glsl */ `
float godotAcosApprox(float p_x) {
  float x = abs(p_x);
  float res = -0.156583 * x + 1.5707963267949;
  res *= sqrt(1.0 - x);
  return (p_x >= 0.0) ? res : 3.14159265359 - res;
}
`;
