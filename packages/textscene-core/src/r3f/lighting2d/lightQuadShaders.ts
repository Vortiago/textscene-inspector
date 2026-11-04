/**
 * The GLSL a light quad is built from, apart from the material factories in `lightQuad.ts`, so the
 * source reads as one port of `canvas.glsl`.
 */
/*
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import { SHADOW_MAP_BINS } from './shadowPolarMap.js';
import { SHADOW_TAPS } from './shadowTaps.js';
import { glslFloat } from '../../utils/glslLiterals.js';

/**
 * The cookie tap. Godot reads the cookie from a light atlas cleared to transparent black, so a
 * linear tap within half a texel of the cookie's edge blends toward 0 (`texture_storage.cpp:3204`,
 * `canvas.glsl:782`). A clamped sample would hold the edge texel whole. With every outside texel 0,
 * the filtered value is the clamped sample times the weight the outside texel leaves, per axis.
 * `uCookieEdgeFade` is 0 for a nearest filter, which reads one texel and never blends.
 */
const COOKIE_TAP = /* glsl */ `
uniform sampler2D uCookie;
uniform float uCookieEdgeFade;
vec4 sampleCookie(vec2 uv) {
  vec2 size = vec2(textureSize(uCookie, 0));
  vec2 texel = uv * size;
  vec2 inside = min(min(texel, size - texel) + 0.5, vec2(1.0));
  return texture2D(uCookie, uv) * mix(1.0, inside.x * inside.y, uCookieEdgeFade);
}
`;

export const VERTEX = /* glsl */ `
varying vec2 vLightUv;
void main() {
  vLightUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * The same quad, plus the fragment's world position: the shadow lookup needs where the pixel is,
 * which the cookie's uv cannot say once `offset` has moved the quad off the light's origin.
 */
export const SHADOW_VERTEX = /* glsl */ `
varying vec2 vLightUv;
varying vec2 vWorld;
void main() {
  vLightUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xy;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/**
 * The cookie arrives raw, tagged `NoColorSpace`, as Godot's non-HDR canvas reads it
 * (`texture_storage.cpp:754`). Nothing is clamped: the accumulator is a float, and Godot
 * clamps only after the light has been multiplied into an item's albedo.
 */
export const FRAGMENT = /* glsl */ `
${COOKIE_TAP}
uniform vec3 uColor;
uniform float uEnergy;
varying vec2 vLightUv;
void main() {
  vec4 cookie = sampleCookie(vLightUv);
  gl_FragColor = vec4(cookie.rgb * uColor * uEnergy, cookie.a);
}
`;

/**
 * The light-local point to the map's `(u, depth)`, `canvas.glsl:814-834`'s quadrant block, then the
 * taps (`shadowTaps.ts`). The map repeats on u, so a tap past either end reads the bin across the
 * seam.
 */
export const SHADOW_SAMPLE = /* glsl */ `
uniform sampler2D uShadowMap;
uniform mat3 uWorldToLight;
uniform float uShadowZFarInv;
varying vec2 vWorld;

float shadowTexel(float texel) {
  return texture2D(uShadowMap, vec2((texel + 0.5) / ${glslFloat(SHADOW_MAP_BINS)}, 0.5)).r;
}
${SHADOW_TAPS}
float shadowFraction() {
  // Godot states the quadrant rule in its own Y-DOWN canvas space. The previewer renders the 2D
  // subtree conjugated by diag(1, -1), so the light-local point flips back before the mapping.
  vec2 local = (uWorldToLight * vec3(vWorld, 1.0)).xy;
  vec2 shadow_pos = vec2(local.x, -local.y);

  vec2 pos_norm = normalize(shadow_pos);
  vec2 pos_abs = abs(pos_norm);
  vec2 pos_box = pos_norm / max(pos_abs.x, pos_abs.y);
  vec2 pos_rot = pos_norm * mat2(vec2(0.7071067811865476, -0.7071067811865476), vec2(0.7071067811865476, 0.7071067811865476));

  float tex_ofs;
  float dist;
  if (pos_rot.y > 0.0) {
    if (pos_rot.x > 0.0) {
      tex_ofs = pos_box.y * 0.125 + 0.125;
      dist = shadow_pos.x;
    } else {
      tex_ofs = pos_box.x * -0.125 + (0.25 + 0.125);
      dist = shadow_pos.y;
    }
  } else {
    if (pos_rot.x < 0.0) {
      tex_ofs = pos_box.y * -0.125 + (0.5 + 0.125);
      dist = -shadow_pos.x;
    } else {
      tex_ofs = pos_box.x * 0.125 + (0.75 + 0.125);
      dist = -shadow_pos.y;
    }
  }
  return shadowTaps(tex_ofs, dist * uShadowZFarInv);
}
`;

/**
 * The cookie quad's share of `canvas.glsl:547`, with the albedo in `C` (line 814) and `S` the shadow
 * colour: `C·(1−s)·cookie.a·((1−s) + S.a·s)`. At the transparent default that is a (1−s)² falloff,
 * as Godot 4.6.3 shows: PCF5 over 0.25 steps 167/129/100/80/67/63 of 255, not (1−s)'s 167/146/…/64.
 */
export const SHADOWED_FRAGMENT = /* glsl */ `
${COOKIE_TAP}
uniform vec3 uColor;
uniform float uEnergy;
uniform vec4 uShadowColor;
varying vec2 vLightUv;
void main() {
  vec4 cookie = sampleCookie(vLightUv);
  float s = shadowFraction();
  float lit = 1.0 - s;
  gl_FragColor = vec4(
    cookie.rgb * uColor * uEnergy * lit,
    cookie.a * (lit + s * uShadowColor.a)
  );
}
`;

/**
 * The `shadow_color` quad's share, never albedo-scaled: rgb `S.rgb·s` under the light's whole alpha
 * `cookie.a·((1−s) + S.a·s)`, the same alpha the cookie quad carries. A MIX blend then scales both
 * buffers alike, and at `s = 1` the quad draws `(S.rgb, cookie.a · S.a)`.
 */
export const SHADOWED_TINT_FRAGMENT = /* glsl */ `
${COOKIE_TAP}
uniform vec4 uShadowColor;
varying vec2 vLightUv;

void main() {
  vec4 cookie = sampleCookie(vLightUv);
  float s = shadowFraction();
  gl_FragColor = vec4(uShadowColor.rgb * s, cookie.a * ((1.0 - s) + s * uShadowColor.a));
}
`;
