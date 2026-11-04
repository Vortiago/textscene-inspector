/**
 * The shadow taps every shadowed 2D light reads its one-row map with: renderer_rd's
 * `light_shadow_compute` kernels (`canvas.glsl:507-535`) over `texture_shadow` (`:392-399`). The
 * PointLight2D and DirectionalLight2D maps differ only past their ends, so each light declares
 * `float shadowTexel(float texel)`, the depth of one bin, before this chunk.
 */
/*
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import { SHADOW_MAP_BINS } from './shadowPolarMap.js';
import { glslFloat } from '../../utils/glslLiterals.js';

/**
 * `renderer_canvas_render_rd.cpp:629`:
 * `shadow_pixel_size = (1.0 / state.shadow_texture_size) * (1.0 + l->shadow_smooth)`, one PCF
 * tap's step along the map. NONE ignores it: its floor takes the canvas-wide bin (`:727`).
 */
export function shadowPixelSize(smooth: number): number {
  return (1 + smooth) / SHADOW_MAP_BINS;
}

/**
 * `shadowTaps(u, depth)` is the light's shadow fraction at map coordinate `u` for a fragment at
 * `depth`. `SHADOW_FILTER` 0 is NONE's single nearest bin, 1 and 2 the PCF5 and PCF13 taps. Each
 * PCF tap floors `u` to bin i by the canvas-wide bin, reads bins i−1 and i, and mixes their steps
 * by the fraction past the floor, as `texture_shadow`'s `textureGather` does.
 */
export const SHADOW_TAPS = /* glsl */ `
uniform float uShadowPixelSize;

float textureShadow(float u, float depth) {
  float scaled = u * ${glslFloat(SHADOW_MAP_BINS)};
  float texel = floor(scaled);
  return mix(step(shadowTexel(texel - 1.0), depth), step(shadowTexel(texel), depth), scaled - texel);
}

float shadowTaps(float u, float depth) {
#if SHADOW_FILTER == 0
  return step(shadowTexel(floor(u * ${glslFloat(SHADOW_MAP_BINS)})), depth);
#else
#if SHADOW_FILTER == 2
  const int reach = 6;
#else
  const int reach = 2;
#endif
  float shadow = 0.0;
  for (int tap = -reach; tap <= reach; tap++) shadow += textureShadow(u + uShadowPixelSize * float(tap), depth);
  return shadow / float(2 * reach + 1);
#endif
}
`;
