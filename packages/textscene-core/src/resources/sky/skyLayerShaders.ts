/**
 * The hand passes of a sky bake that no Godot compute stage draws, ported to GLSL ES from Godot
 * 4.6.3's `servers/rendering/renderer_rd/shaders/oct_inc.glsl`: the radiance cube into the octmap,
 * and a mip of layer 0 back out. The chain and the filters draw Godot's own stages, lowered.
 *
 * Portions ported from Godot Engine, used under the MIT licence:
 *
 *   Copyright (c) 2014-present Godot Engine contributors (see AUTHORS.md).
 *   Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 *
 * See THIRD-PARTY-NOTICES.md.
 */

/**
 * `oct_inc.glsl:2-41`. `borderSize` is 1 minus twice the padding in UV. The guard lets the sky's and
 * the probes' chunks both hold it in one program.
 */
export const OCTMAP_GLSL = /* glsl */ `
#ifndef GODOT_OCTMAP
#define GODOT_OCTMAP
vec3 octToVec3(vec2 e) {
  vec3 v = vec3(e.xy, 1.0 - abs(e.x) - abs(e.y));
  float t = max(-v.z, 0.0);
  v.xy += t * -sign(v.xy);
  return normalize(v);
}

vec3 octToVec3WithBorder(vec2 uv, float borderSize) {
  uv = (uv - 0.5) * (2.0 / borderSize);
  vec2 mask = step(vec2(1.0), abs(uv));
  uv = 2.0 * clamp(uv, -1.0, 1.0) - uv;
  uv = mix(uv, -uv, mask.yx);
  return octToVec3(uv);
}

vec2 octWrap(vec2 v) {
  vec2 signs = vec2(v.x >= 0.0 ? 1.0 : -1.0, v.y >= 0.0 ? 1.0 : -1.0);
  return (1.0 - abs(v.yx)) * signs;
}

vec2 vec3ToOctWithBorder(vec3 n, float borderSize) {
  n /= abs(n.x) + abs(n.y) + abs(n.z);
  n.xy = n.z >= 0.0 ? n.xy : octWrap(n.xy);
  return (n.xy * 0.5 + 0.5) * borderSize + (1.0 - borderSize) * 0.5;
}
#endif
`;

/** Godot's and WebGL's octmap texels share `gl_FragCoord`, as both count rows from the first. */
export const RADIANCE_OCTMAP_FRAGMENT_SHADER = /* glsl */ `
uniform samplerCube radiance;
uniform float size;
uniform float borderSize;
${OCTMAP_GLSL}
void main() {
  vec3 direction = octToVec3WithBorder(gl_FragCoord.xy / size, borderSize);
  gl_FragColor = vec4(textureLod(radiance, direction, 0.0).rgb, 1.0);
}
`;

/** One mip of radiance layer 0, texel for texel, top row first as the half and quarter passes draw. */
export const RADIANCE_MIP_FRAGMENT_SHADER = /* glsl */ `
uniform highp sampler2DArray layers;
uniform int mip;

void main() {
  int rows = textureSize(layers, mip).y;
  gl_FragColor = texelFetch(layers, ivec3(int(gl_FragCoord.x), rows - 1 - int(gl_FragCoord.y), 0), mip);
}
`;
