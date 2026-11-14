/**
 * The GLSL every shadowed 2D light reads its one-row map with: renderer_rd's `light_shadow_compute`
 * taps (`canvas.glsl:507-535`) over `texture_shadow` (`:392-399`), the lookup of each light kind, and
 * the split of `canvas.glsl:543-547` into the light and the `shadow_color` outputs.
 */

/*
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import * as THREE from 'three';
import type { Rgba } from '../../../godot/math/math.js';
import { SHADOW_MAP_FAR } from './shadowPolarMap.js';
import type { ShadowMapEdge } from './shadowMapTexture.js';

/**
 * The shadow lookup of one light kind: the edge of its map and its mapping from the fragment to
 * (u, depth). The map's texture and its texel rule both read `edge`, so the two cannot disagree.
 */
export interface ShadowLookup {
  /**
   * How a tap past an end of the row reads, in the texture and in `shadowTexel`. A clamped map is
   * a DirectionalLight2D's, whose empty bins also read as lit.
   */
  readonly edge: ShadowMapEdge;
  /** The uniforms and varyings `fraction` reads. */
  readonly declarations: string;
  /** `float shadowFraction()`, which maps the fragment to `shadowTaps(u, depth)`. */
  readonly fraction: string;
}

const MAP_UNIFORM = /* glsl */ `
uniform sampler2D uShadowMap;
`;

/**
 * `float shadowBins()`, the texels in the light's map: `shadow_texture_size`. A uniform, not
 * `textureSize`, so a fragment's thirteen taps read one value. `shadowMapUniforms` writes it from
 * the map's own width.
 */
const SHADOW_BINS = /* glsl */ `
uniform float uShadowBins;
float shadowBins() { return uShadowBins; }
`;

/** The depth an empty bin compares as: past any fragment, so `step` leaves it lit. */
const EMPTY_BIN_DEPTH = '1e30';

/** `float shadowTexel(float texel)`, the depth of one bin, for each edge. */
const SHADOW_TEXEL: Record<ShadowMapEdge, string> = {
  repeat: /* glsl */ `
// Godot also quantises the row by 1/shadow_pixel_size (canvas.glsl:394,508), so below size 512
// with two shadowed lights a light reads another's row. Not modelled: each light has its own map.
float shadowTexel(float texel) {
  return texture2D(uShadowMap, vec2((texel + 0.5) / shadowBins(), 0.5)).r;
}
`,
  clamp: /* glsl */ `
// An empty bin never shadows. The camera can show past the viewport's far edge, where depth
// exceeds SHADOW_MAP_FAR, and a bin left at SHADOW_MAP_FAR would shadow all of it.
float shadowTexel(float texel) {
  float binDepth = texture2D(uShadowMap, vec2((clamp(texel, 0.0, shadowBins() - 1.0) + 0.5) / shadowBins(), 0.5)).r;
  return binDepth >= float(${SHADOW_MAP_FAR}) ? ${EMPTY_BIN_DEPTH} : binDepth;
}
`,
};

/**
 * `shadowTaps(u, depth)` is the light's shadow fraction at map coordinate `u` for a fragment at
 * `depth`. `SHADOW_FILTER` 0 is NONE's single nearest bin, 1 and 2 the PCF5 and PCF13 taps. Each
 * PCF tap floors `u` to bin i by the canvas-wide bin, reads bins i−1 and i, and mixes their steps
 * by the fraction past the floor, as `texture_shadow`'s `textureGather` does. A tap steps by
 * `(1.0 / shadow_texture_size) * (1.0 + shadow_smooth)` (`renderer_canvas_render_rd.cpp:629`). NONE
 * ignores it: its floor takes the canvas-wide bin (`:727`).
 */
const SHADOW_TAPS = /* glsl */ `
uniform float uShadowSmooth;

float textureShadow(float u, float depth) {
  float scaled = u * shadowBins();
  float texel = floor(scaled);
  return mix(step(shadowTexel(texel - 1.0), depth), step(shadowTexel(texel), depth), scaled - texel);
}

float shadowTaps(float u, float depth) {
#if SHADOW_FILTER == 0
  return step(shadowTexel(floor(u * shadowBins())), depth);
#else
#if SHADOW_FILTER == 2
  const int reach = 6;
#else
  const int reach = 2;
#endif
  float tapStep = (1.0 + uShadowSmooth) / shadowBins();
  float shadow = 0.0;
  for (int tap = -reach; tap <= reach; tap++) shadow += textureShadow(u + tapStep * float(tap), depth);
  return shadow / float(2 * reach + 1);
#endif
}
`;

/**
 * The whole sample block, joined in the one legal order: the map uniform, the lookup's
 * declarations, the bins, the texel rule, the taps, the fraction. The taps call `shadowBins` and
 * `shadowTexel`, so each must come before them.
 *
 * @canonical The GLSL a 2D light samples its shadow map with
 */
export function shadowSampleGlsl({ edge, declarations, fraction }: ShadowLookup): string {
  return [MAP_UNIFORM, declarations, SHADOW_BINS, SHADOW_TEXEL[edge], SHADOW_TAPS, fraction].join('');
}

/**
 * A PointLight2D's light-local point to the polar map's `(u, depth)`: `canvas.glsl:814-834`'s
 * quadrant block. `vWorld` comes from `POLAR_SHADOW_VERTEX`.
 */
export const POLAR_LOOKUP: ShadowLookup = {
  edge: 'repeat',
  declarations: /* glsl */ `
uniform mat3 uWorldToLight;
uniform float uShadowZFarInv;
varying vec2 vWorld;
`,
  fraction: /* glsl */ `
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
`,
};

/** A DirectionalLight2D's `(u, depth)`, which `DIRECTIONAL_SHADOW_VERTEX` already wrote to `vShadow`. */
export const DIRECTIONAL_LOOKUP: ShadowLookup = {
  edge: 'clamp',
  declarations: /* glsl */ `
varying vec2 vShadow;
`,
  fraction: /* glsl */ `
float shadowFraction() {
  return shadowTaps(vShadow.x, vShadow.y);
}
`,
};

/**
 * A PointLight2D's quad plus the fragment's world position: the shadow lookup needs where the pixel
 * is, which the cookie's uv cannot say once `offset` has moved the quad off the light's origin.
 */
export const POLAR_SHADOW_VERTEX = /* glsl */ `
varying vec2 vLightUv;
varying vec2 vWorld;
void main() {
  vLightUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xy;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/** A DirectionalLight2D's full-screen quad, with its NDC position taken to the map's `(u, depth)`. */
export const DIRECTIONAL_SHADOW_VERTEX = /* glsl */ `
uniform mat3 uNdcToShadow;
varying vec2 vShadow;
void main() {
  vec2 ndc = position.xy * 2.0;
  vShadow = (uNdcToShadow * vec3(ndc, 1.0)).xy;
  gl_Position = vec4(ndc, 0.0, 1.0);
}
`;

/**
 * `canvas.glsl:543-547` replaces the light term, `light_color = mix(light_color, shadow_color, shadow)`
 * after `shadow_color.a *= light_color.a`, and the previewer splits it in two buffers. The light
 * term `rgb` carries the albedo `C` (line 814): `C·(1−s)·a·((1−s) + S.a·s)`. At the transparent
 * default that is a (1−s)² falloff, as Godot 4.6.3 shows: PCF5 over 0.25 steps 167/129/100/80/67/63
 * of 255, not (1−s)'s 167/146/…/64. The `shadow_color` term is never albedo-scaled: rgb `S.rgb·s`
 * under the light's whole alpha, so a MIX blend scales both buffers alike. At `s = 1` the quad draws
 * `(S.rgb, a · S.a)`. It calls `writeLight`, so `LIGHT_OUTPUTS` comes before it.
 */
export const SHADOWED_LIGHT_GLSL = /* glsl */ `
uniform vec4 uShadowColor;
void writeShadowedLight(vec3 rgb, float a, float s) {
  float lit = 1.0 - s;
  float alpha = a * (lit + s * uShadowColor.a);
  writeLight(vec4(rgb * lit, alpha), vec4(uShadowColor.rgb * s, alpha));
}
`;

/** `Light2D.shadow_color` as the `uShadowColor` that `SHADOWED_LIGHT_GLSL` declares. */
export function shadowedLightUniforms({ r, g, b, a }: Rgba): { uShadowColor: THREE.IUniform<THREE.Vector4> } {
  return { uShadowColor: { value: new THREE.Vector4(r, g, b, a) } };
}
