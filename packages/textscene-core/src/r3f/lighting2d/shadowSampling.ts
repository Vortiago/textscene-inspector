/**
 * What a filtered light hands its quads so each fragment can evaluate its own
 * shadow fraction: the polar map as a GPU texture, the light-local transform,
 * and the kernel the `SHADOW_FILTER` define selects.
 *
 * The stencil mechanism needs none of this — it partitions lit from shadowed
 * geometrically. This is only the `shadow_filter = PCF5/PCF13` path.
 *
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
 * `shadow_pixel_size = (1.0 / state.shadow_texture_size) * (1.0 + l->shadow_smooth)`
 * — one tap's step along the atlas's u axis, i.e. an ANGULAR step around the light.
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
   * `Light2D.shadow_color`. It belongs to the sampling because only a FILTERED
   * cookie quad reads one: the stencil mechanism partitions the two terms
   * between two quads, so its cookie fragment has no `shadow_color` term at all.
   * The tint quad carries the colour in its own right, filtered or not.
   */
  readonly shadowColor: Color;
}

/**
 * One light's polar map as a texture the quad can tap.
 *
 * `LinearFilter` and `RepeatWrapping` are Godot's own atlas state
 * (`rasterizer_canvas_gles3.cpp:1885-1888`), not a choice: the linear read is
 * what rounds each PCF step's corner, and the wrap is what lets a tap cross the
 * seam between the last bin and the first. Half-float because linear filtering
 * of half-float textures is core WebGL2 while the float32 equivalent is an
 * extension; the values are normalised to [0, 1] where the relative precision
 * costs well under a tenth of a pixel of occluder distance.
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
 * `existing` refilled from `bins` where it can be, a fresh texture otherwise.
 *
 * A light rebuilds its map whenever an occluder settles or moves, which during
 * load is several times per light. The texture is the only thing downstream of
 * the map that costs a GPU allocation, and its IDENTITY is what the quad's
 * material holds in `uShadowMap` — so replacing it would rebuild the material
 * (and the shadow-tint material) to change nothing the shader can observe.
 * Keeping it means a rebuild re-uploads 4 KB and stops there.
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
