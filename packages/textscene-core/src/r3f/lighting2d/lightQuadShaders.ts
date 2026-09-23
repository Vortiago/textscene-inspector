/**
 * The GLSL a light quad is built from, apart from the material factories in `lightQuad.ts`, so the
 * source reads as one port of `canvas.glsl`.
 */
/*
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import { GODOT_TO_SRGB_GLSL } from './srgbTransfer.js';

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
 * The cookie arrives decoded to linear (three tags loaded textures
 * `SRGBColorSpace`), so it is re-encoded to recover Godot's texel before the
 * light maths. Nothing is clamped: the accumulator is half-float, and Godot
 * clamps only after the light has been multiplied into an item's albedo.
 */
export const FRAGMENT = /* glsl */ `
uniform sampler2D uCookie;
uniform vec3 uColor;
uniform float uEnergy;
varying vec2 vLightUv;
${GODOT_TO_SRGB_GLSL}
void main() {
  vec4 cookie = texture2D(uCookie, vLightUv);
  gl_FragColor = vec4(godotToSrgb(cookie.rgb) * uColor * uEnergy, cookie.a);
}
`;

/**
 * The shadowed half of `light_shadow_compute`. The cookie is sampled for its alpha alone: `mix`
 * overwrites rgb, so the light's colour, its energy, the cookie's rgb and the albedo multiply all
 * drop out.
 */
export const SHADOW_FRAGMENT = /* glsl */ `
uniform sampler2D uCookie;
uniform vec4 uShadowColor;
varying vec2 vLightUv;

void main() {
  vec4 cookie = texture2D(uCookie, vLightUv);
  gl_FragColor = vec4(uShadowColor.rgb, uShadowColor.a * cookie.a);
}
`;

/**
 * `light_shadow_compute`'s tap loops and their quadrant block, from `canvas.glsl:458-503` and
 * `canvas.glsl:819-848`. `SHADOW_FILTER` selects the kernel as `LIGHT_FLAGS_FILTER_MASK` does. The
 * taps step along the map's angular axis, so the penumbra widens with distance from the light.
 */
export const SHADOW_SAMPLE = /* glsl */ `
uniform sampler2D uShadowMap;
uniform mat3 uWorldToLight;
uniform float uShadowZFarInv;
uniform float uShadowPixelSize;
varying vec2 vWorld;

#define SHADOW_TEST(m_u) shadow += step(texture2D(uShadowMap, vec2(m_u, 0.5)).r, dist);

float shadowFraction() {
  // Godot states the quadrant rule in its own Y-DOWN canvas space; the previewer
  // renders the 2D subtree conjugated by diag(1, -1), so the light-local point
  // is flipped back before the mapping rather than the mapping being re-derived.
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
  dist *= uShadowZFarInv;

  float shadow = 0.0;
#if SHADOW_FILTER == 2
  SHADOW_TEST(tex_ofs - uShadowPixelSize * 6.0);
  SHADOW_TEST(tex_ofs - uShadowPixelSize * 5.0);
  SHADOW_TEST(tex_ofs - uShadowPixelSize * 4.0);
  SHADOW_TEST(tex_ofs - uShadowPixelSize * 3.0);
  SHADOW_TEST(tex_ofs - uShadowPixelSize * 2.0);
  SHADOW_TEST(tex_ofs - uShadowPixelSize);
  SHADOW_TEST(tex_ofs);
  SHADOW_TEST(tex_ofs + uShadowPixelSize);
  SHADOW_TEST(tex_ofs + uShadowPixelSize * 2.0);
  SHADOW_TEST(tex_ofs + uShadowPixelSize * 3.0);
  SHADOW_TEST(tex_ofs + uShadowPixelSize * 4.0);
  SHADOW_TEST(tex_ofs + uShadowPixelSize * 5.0);
  SHADOW_TEST(tex_ofs + uShadowPixelSize * 6.0);
  shadow /= 13.0;
#else
  SHADOW_TEST(tex_ofs - uShadowPixelSize * 2.0);
  SHADOW_TEST(tex_ofs - uShadowPixelSize);
  SHADOW_TEST(tex_ofs);
  SHADOW_TEST(tex_ofs + uShadowPixelSize);
  SHADOW_TEST(tex_ofs + uShadowPixelSize * 2.0);
  shadow /= 5.0;
#endif
  return shadow;
}
`;

/**
 * The cookie quad's share of `canvas.glsl:502`, with the albedo in `C` (line 814) and `S` the shadow
 * colour: `C·(1−s)·cookie.a·((1−s) + S.a·s)`. At the transparent default that is a (1−s)² falloff,
 * as Godot 4.6.3 shows: PCF5 over 0.25 steps 167/129/100/80/67/63 of 255, not (1−s)'s 167/146/…/64.
 */
export const SHADOWED_FRAGMENT = /* glsl */ `
uniform sampler2D uCookie;
uniform vec3 uColor;
uniform float uEnergy;
uniform vec4 uShadowColor;
varying vec2 vLightUv;
${GODOT_TO_SRGB_GLSL}
void main() {
  vec4 cookie = texture2D(uCookie, vLightUv);
  float s = shadowFraction();
  float lit = 1.0 - s;
  gl_FragColor = vec4(
    godotToSrgb(cookie.rgb) * uColor * uEnergy * lit,
    cookie.a * (lit + s * uShadowColor.a)
  );
}
`;

/**
 * The `shadow_color` quad's share, never albedo-scaled: `S.rgb·s·cookie.a·((1−s) + S.a·s)`. The sum
 * has no cross term, so the split is exact, and at `s = 1` this is `cookie.a · S.a`, byte-identical
 * to the stencil path.
 */
export const SHADOWED_TINT_FRAGMENT = /* glsl */ `
uniform sampler2D uCookie;
uniform vec4 uShadowColor;
varying vec2 vLightUv;

void main() {
  vec4 cookie = texture2D(uCookie, vLightUv);
  float s = shadowFraction();
  gl_FragColor = vec4(uShadowColor.rgb, cookie.a * s * ((1.0 - s) + s * uShadowColor.a));
}
`;
