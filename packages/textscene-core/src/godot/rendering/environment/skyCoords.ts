/**
 * Godot's `SKY_COORDS` as GLSL: the equirectangular coordinates of an eye direction, through the
 * approximations of `acos` and `atan2` its sky shader uses (`sky.glsl:179-201`, `:226-232`). Every
 * sky shader that samples a panorama, and its radiance bake, concatenates this one text.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { GODOT_ACOS_APPROX_GLSL } from '../acosApprox.js';

/**
 * `godotSkyCoords(eyedir)` is u from 0 at -Z, turning towards +X, and v from 0 at +Y to 1 at -Y.
 * Like Godot's, it has no guard: a direction straight up or down divides 0 by 0 for u.
 */
export const GODOT_SKY_COORDS_GLSL = /* glsl */ `
const float GODOT_SKY_PI = 3.14159265359;
${GODOT_ACOS_APPROX_GLSL}

float godotAtan2Approx(float y, float x) {
  float a = min(abs(x), abs(y)) / max(abs(x), abs(y));
  float s = a * a;
  float poly = 0.0872929;
  poly = -0.301895 + poly * s;
  poly = 1.0 + poly * s;
  poly = poly * a;

  float r = abs(y) > abs(x) ? (GODOT_SKY_PI / 2.0) - poly : poly;
  r = x < 0.0 ? GODOT_SKY_PI - r : r;
  r = y < 0.0 ? -r : r;
  return r;
}

vec2 godotSkyCoords(vec3 eyedir) {
  vec2 coords = vec2(godotAtan2Approx(eyedir.x, -eyedir.z), godotAcosApprox(eyedir.y));
  if (coords.x < 0.0) {
    coords.x += GODOT_SKY_PI * 2.0;
  }
  return coords / vec2(GODOT_SKY_PI * 2.0, GODOT_SKY_PI);
}
`;
