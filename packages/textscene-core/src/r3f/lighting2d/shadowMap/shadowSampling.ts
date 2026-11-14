/**
 * What a shadowed PointLight2D hands its quads so each fragment evaluates its own shadow fraction:
 * the polar map as a texture, the light-local transform, and the taps the `SHADOW_FILTER` define
 * selects (`shadowTaps.ts`).
 */

/*
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import * as THREE from 'three';
import type { Rgba } from '../../../godot/math/math.js';
import type { Light2DShadowFilter } from '../../../godot/scene/light2d.js';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';
import { shadowMapUniforms } from './shadowTaps.js';
import { shadowMapZFarInv, type ShadowPolarLight } from './shadowPolarMap.js';

/**
 * The light's pose as its quads read it. Every quad of one light shares these objects, and
 * `writeShadowPose` updates them in place, so a moving light keeps its ShaderMaterials.
 */
export interface ShadowPoseUniforms {
  /** Previewer world → light-local, Godot's `xform_cache.affine_inverse()`. */
  readonly uWorldToLight: THREE.IUniform<THREE.Matrix3>;
  /** `1 / (radius_cache * 1.1)`, the divisor the map was normalised by. */
  readonly uShadowZFarInv: THREE.IUniform<number>;
}

export function createShadowPoseUniforms(): ShadowPoseUniforms {
  return { uWorldToLight: { value: new THREE.Matrix3() }, uShadowZFarInv: { value: 0 } };
}

export function writeShadowPose(uniforms: ShadowPoseUniforms, light: ShadowPolarLight): void {
  const m = light.worldToLocal;
  uniforms.uWorldToLight.value.set(m[0]!, m[1]!, m[2]!, m[3]!, m[4]!, m[5]!, 0, 0, 1);
  uniforms.uShadowZFarInv.value = shadowMapZFarInv(light.radius);
}

/** Everything a quad needs to evaluate one light's shadow per fragment. */
export interface ShadowSampling {
  /** The light's polar map, from `updateShadowPolarTexture`. */
  readonly map: THREE.Texture;
  /** `Light2D.shadow_filter`. NONE takes one nearest bin. */
  readonly filter: EnumValue<typeof Light2DShadowFilter>;
  /** `Light2D.shadow_filter_smooth`, widening the PCF taps. */
  readonly smooth: number;
  /** The light's pose, which the light writes as it moves. */
  readonly pose: ShadowPoseUniforms;
  /** `Light2D.shadow_color`, which the light quad reads for both of its terms. */
  readonly shadowColor: Rgba;
}

/**
 * One light's polar map as a texture: Godot's `R32_SFLOAT` atlas row behind a nearest sampler that
 * repeats on u (`renderer_canvas_render_rd.cpp:975-980,1930-1934`), so a tap at bin −1 reads the
 * last bin. A half float rounds the stored depth, and a fragment on the occluder line then reads
 * as shadowed where Godot lights it.
 */
function createShadowPolarTexture(bins: Float32Array): THREE.DataTexture {
  const texture = new THREE.DataTexture(
    new Float32Array(bins.length),
    bins.length,
    1,
    THREE.RedFormat,
    THREE.FloatType
  );
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.generateMipmaps = false;
  fillShadowPolarTexture(texture, bins);
  return texture;
}

function fillShadowPolarTexture(texture: THREE.DataTexture, bins: Float32Array): void {
  (texture.image.data as Float32Array).set(bins);
  texture.needsUpdate = true;
}

/**
 * `existing` refilled from `bins` where it can be, a fresh texture otherwise. The
 * map rebuilds whenever an occluder settles or moves, and the materials hold the
 * texture's identity in `uShadowMap`, so keeping it makes a rebuild a
 * re-upload of the row (8 KB at the default size) rather than a rebuild of both materials.
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

export function shadowSamplingParameters(shadow: ShadowSampling): Pick<
  THREE.ShaderMaterialParameters,
  'defines'
> & {
  uniforms: Record<string, THREE.IUniform>;
} {
  return {
    defines: { SHADOW_FILTER: shadow.filter },
    uniforms: {
      ...shadowMapUniforms(shadow.map),
      ...shadow.pose,
      uShadowSmooth: { value: shadow.smooth },
    },
  };
}
