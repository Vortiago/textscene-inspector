/**
 * The shadow taps every shadowed 2D light reads its one-row map with: renderer_rd's
 * `light_shadow_compute` kernels (`canvas.glsl:507-535`) over `texture_shadow` (`:392-399`). The
 * PointLight2D and DirectionalLight2D maps differ only past their ends, so each light declares
 * `float shadowTexel(float texel)`, the depth of one bin, before this chunk, and `SHADOW_BINS`
 * before that.
 */

/*
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import type * as THREE from 'three';
import { imageSize } from '../../resources/formats/image/imagePixels';

/**
 * `float shadowBins()`, the texels in the light's map: `shadow_texture_size`. A uniform, not
 * `textureSize`, so a fragment's thirteen taps read one value. `shadowMapUniforms` writes it from
 * the map's own width, so the texture and every tap agree on it.
 */
export const SHADOW_BINS = /* glsl */ `
uniform float uShadowBins;
float shadowBins() { return uShadowBins; }
`;

/** `uShadowMap` and the `uShadowBins` its taps divide by, which a light declares together. */
export function shadowMapUniforms(map: THREE.Texture): {
  uShadowMap: THREE.IUniform<THREE.Texture>;
  uShadowBins: THREE.IUniform<number>;
} {
  const size = imageSize(map.image);
  if (!size) throw new Error('expected a shadow map with an image, got a texture without one');
  return { uShadowMap: { value: map }, uShadowBins: { value: size.width } };
}

/**
 * `shadowTaps(u, depth)` is the light's shadow fraction at map coordinate `u` for a fragment at
 * `depth`. `SHADOW_FILTER` 0 is NONE's single nearest bin, 1 and 2 the PCF5 and PCF13 taps. Each
 * PCF tap floors `u` to bin i by the canvas-wide bin, reads bins i−1 and i, and mixes their steps
 * by the fraction past the floor, as `texture_shadow`'s `textureGather` does. A tap steps by
 * `(1.0 / shadow_texture_size) * (1.0 + shadow_smooth)` (`renderer_canvas_render_rd.cpp:629`). NONE
 * ignores it: its floor takes the canvas-wide bin (`:727`).
 */
export const SHADOW_TAPS = /* glsl */ `
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
