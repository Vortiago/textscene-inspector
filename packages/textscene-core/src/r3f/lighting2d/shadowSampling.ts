/**
 * What a `shadow_filter = PCF5/PCF13` light hands its quads so each fragment
 * evaluates its own shadow fraction: the polar map as a texture, the light-local
 * transform, and the kernel the `SHADOW_FILTER` define selects.
 */

/*
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import * as THREE from 'three';
import type { Color } from '../../nodes/base/node2d/types.js';
import { SHADOW_MAP_BINS } from './shadowPolarMap.js';
// Type-only, so the pair of modules never form a runtime cycle: the filter
// constants are declared beside the quads that branch on them.
import type { SHADOW_FILTER_PCF5, SHADOW_FILTER_PCF13 } from './lightQuad.js';

/**
 * `rasterizer_canvas_gles3.cpp:182`:
 * `shadow_pixel_size = (1.0 / state.shadow_texture_size) * (1.0 + l->shadow_smooth)`,
 * one tap's step along the atlas's u axis, which is an angular step around the light.
 */
export function shadowPixelSize(smooth: number): number {
  return (1 + smooth) / SHADOW_MAP_BINS;
}

/** Everything a quad needs to evaluate one light's filtered shadow per fragment. */
export interface ShadowSampling {
  /** The light's polar map, from `createShadowPolarTexture`. */
  readonly map: THREE.Texture;
  /** `Light2D.shadow_filter`. `SHADOW_FILTER_NONE` never reaches here. */
  readonly filter: typeof SHADOW_FILTER_PCF5 | typeof SHADOW_FILTER_PCF13;
  /** `Light2D.shadow_filter_smooth`, widening the kernel. */
  readonly smooth: number;
  /** Previewer world → light-local, Godot's `xform_cache.affine_inverse()`. */
  readonly worldToLocal: THREE.Matrix3;
  /** `1 / (radius_cache * 1.1)`, the divisor the map was normalised by. */
  readonly zFarInv: number;
  /**
   * `Light2D.shadow_color`. Only a filtered cookie quad reads it: the stencil
   * mechanism splits the two terms between two quads. The tint quad carries the
   * colour itself, filtered or not.
   */
  readonly shadowColor: Color;
}

/**
 * One light's polar map as a texture. `LinearFilter` and `RepeatWrapping` are
 * Godot's atlas state (`rasterizer_canvas_gles3.cpp:1885-1888`). Half-float, since
 * linear filtering of half-float is core WebGL2 and float32 an extension: on
 * [0, 1] it costs under a tenth of a pixel of occluder distance.
 */
export function createShadowPolarTexture(bins: Float32Array): THREE.DataTexture {
  const texture = new THREE.DataTexture(
    new Uint16Array(bins.length),
    bins.length,
    1,
    THREE.RedFormat,
    THREE.HalfFloatType
  );
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.generateMipmaps = false;
  fillShadowPolarTexture(texture, bins);
  return texture;
}

function fillShadowPolarTexture(texture: THREE.DataTexture, bins: Float32Array): void {
  const data = texture.image.data as Uint16Array;
  for (let i = 0; i < bins.length; i += 1) data[i] = THREE.DataUtils.toHalfFloat(bins[i]!);
  texture.needsUpdate = true;
}

/**
 * `existing` refilled from `bins` where it can be, a fresh texture otherwise. The
 * map rebuilds whenever an occluder settles or moves, and the materials hold the
 * texture's identity in `uShadowMap`, so keeping it makes a rebuild a 4 KB
 * re-upload rather than a rebuild of both materials.
 */
export function updateShadowPolarTexture(
  existing: THREE.DataTexture | null,
  bins: Float32Array
): THREE.DataTexture {
  const data = existing?.image.data as ArrayLike<number> | undefined;
  if (!existing || data?.length !== bins.length) return createShadowPolarTexture(bins);
  fillShadowPolarTexture(existing, bins);
  return existing;
}

export function shadowSamplingParameters(
  shadow: ShadowSampling
): Pick<THREE.ShaderMaterialParameters, 'defines'> & {
  uniforms: Record<string, THREE.IUniform>;
} {
  return {
    defines: { SHADOW_FILTER: shadow.filter },
    uniforms: {
      uShadowMap: { value: shadow.map },
      uWorldToLight: { value: shadow.worldToLocal },
      uShadowZFarInv: { value: shadow.zFarInv },
      uShadowPixelSize: { value: shadowPixelSize(shadow.smooth) },
    },
  };
}
