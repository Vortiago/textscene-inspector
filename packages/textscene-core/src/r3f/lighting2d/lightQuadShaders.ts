/**
 * The GLSL a light quad is built from, apart from the material factories in `lightQuad.ts`, so the
 * source reads as one port of `canvas.glsl`.
 */
/*
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import { POLAR_LOOKUP, SHADOWED_LIGHT_GLSL, shadowSampleGlsl } from './shadowMap/shadowShader.js';

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
 * The outputs of a light quad, one per buffer of the list it draws into (`ListAttachments`): the
 * light term, the albedo-free `shadow_color` term, and the Light Only term, which is the light
 * term over another seed. An output with no attachment is dropped, so one program serves every list.
 */
export const LIGHT_OUTPUTS = /* glsl */ `
layout(location = 0) out highp vec4 lightColor;
layout(location = 1) out highp vec4 shadowTint;
layout(location = 2) out highp vec4 lightOnlyColor;
void writeLight(vec4 light, vec4 tint) {
  lightColor = light;
  shadowTint = tint;
  lightOnlyColor = light;
}
`;

/**
 * The cookie arrives raw, tagged `NoColorSpace`, as Godot's non-HDR canvas reads it
 * (`texture_storage.cpp:754`). Nothing is clamped: the accumulator is a float, and Godot
 * clamps only after the light has been multiplied into an item's albedo. With no shadow the
 * `shadow_color` term is the alpha alone, which a MIX blend scales that buffer by.
 */
export const FRAGMENT = /* glsl */ `
${COOKIE_TAP}
${LIGHT_OUTPUTS}
uniform vec3 uColor;
uniform float uEnergy;
varying vec2 vLightUv;
void main() {
  vec4 cookie = sampleCookie(vLightUv);
  writeLight(vec4(cookie.rgb * uColor * uEnergy, cookie.a), vec4(0.0, 0.0, 0.0, cookie.a));
}
`;

/**
 * The cookie-tapped light, shadowed by the polar map (`shadowShader.ts`): the light term's `rgb` is
 * `cookie.rgb · color · energy` and its alpha the cookie's.
 */
export const SHADOWED_FRAGMENT = /* glsl */ `
${shadowSampleGlsl(POLAR_LOOKUP)}
${COOKIE_TAP}
${LIGHT_OUTPUTS}
${SHADOWED_LIGHT_GLSL}
uniform vec3 uColor;
uniform float uEnergy;
varying vec2 vLightUv;
void main() {
  vec4 cookie = sampleCookie(vLightUv);
  writeShadowedLight(cookie.rgb * uColor * uEnergy, cookie.a, shadowFraction());
}
`;
