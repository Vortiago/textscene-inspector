/**
 * The quad materials a PointLight2D adds to the canvas light accumulator: Godot's `light_color`,
 * `rgb = cookie.rgb * color * energy` on the raw cookie texels, unclamped, and `a = cookie.a` raw,
 * since the alpha is both the blend factor and, summed, the Light Only mask. The GLSL is in
 * `lightQuadShaders.ts`.
 */
/*
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import * as THREE from 'three';
import { canvasItemFacing } from '../canvasItemFacing.js';
import { FRAGMENT, SHADOWED_FRAGMENT, VERTEX } from './lightQuadShaders.js';
import { POLAR_SHADOW_VERTEX, shadowedLightUniforms } from './shadowMap/shadowShader.js';
import { multipleTargetPass } from '../fullScreenPass.js';
import { shadowSamplingParameters, type ShadowSampling } from './shadowMap/shadowSampling.js';
import type { Rgba } from '../../godot/math/math.js';
import { Light2DBlendMode, Light2DShadowFilter } from '../../godot/scene/light2d.js';

export type { ShadowSampling } from './shadowMap/shadowSampling.js';

/**
 * `light_blend_compute`'s modes are one fixed-function blend each: ADD is SrcAlpha/One with add,
 * SUB the same with reverse-subtract, and MIX SrcAlpha/OneMinusSrcAlpha with add. Alpha adds
 * One/One: Godot 4.6.3 sums `light_only_alpha`, so one, two and three 0.3 cookies mask to 0.3, 0.6
 * and 0.9, not a screen blend's 0.51 and 0.657. A light quad neither tests nor writes depth.
 */
export function accumulationState(blendMode: number): Partial<THREE.ShaderMaterialParameters> {
  return {
    depthWrite: false,
    depthTest: false,
    // The transparent list sorts farthest-first, replaying canvas draw order. The opaque list
    // sorts nearest-first and would reverse MIX, whose result depends on light order.
    transparent: true,
    blending: THREE.CustomBlending,
    blendEquation: blendMode === Light2DBlendMode.SUB ? THREE.ReverseSubtractEquation : THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: blendMode === Light2DBlendMode.MIX ? THREE.OneMinusSrcAlphaFactor : THREE.OneFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneFactor,
  };
}

/**
 * Whether a `shadow_color` puts anything into the accumulator. Its term is `S.rgb · s` under the
 * alpha `(1 − s) + S.a · s`. A binary shadow leaves only `S.a` in front, so a transparent colour
 * adds nothing, and Godot's default (`light_2d.h:58`) is exactly that. A filtered penumbra keeps
 * `S.rgb · s · (1 − s)`.
 */
export function shadowColorContributes(shadowColor: Rgba, filter: number): boolean {
  if (shadowColor.a > 0) return true;
  return (
    filter !== Light2DShadowFilter.NONE && (shadowColor.r !== 0 || shadowColor.g !== 0 || shadowColor.b !== 0)
  );
}

/** 1 for a linear cookie tap, which blends toward the transparent atlas border; 0 for a nearest tap. */
function edgeFade(cookie: THREE.Texture): number {
  return cookie.magFilter === THREE.NearestFilter ? 0 : 1;
}

interface LightQuadOptions {
  readonly cookie: THREE.Texture;
  /** `Light2D.color`. */
  readonly color: Rgba;
  /** `Light2D.energy`. */
  readonly energy: number;
  readonly blendMode: number;
  /**
   * Set for a shadowed light, whose quad samples the polar map (`shadowPolarMap.ts`) over the whole
   * rect and writes both halves of `canvas.glsl:547`, the albedo-multiplied light term and the
   * `shadow_color` term, from one evaluation of the taps.
   */
  readonly shadow?: ShadowSampling;
}

/**
 * One light's quad: it writes the light term, the `shadow_color` term and the Light Only term to the
 * three outputs of `LIGHT_OUTPUTS`, so one draw fills every buffer of a list.
 */
export function createLightQuadMaterial({
  cookie,
  color,
  energy,
  blendMode,
  shadow,
}: LightQuadOptions): THREE.ShaderMaterial {
  const sampling = shadow ? shadowSamplingParameters(shadow) : null;
  return multipleTargetPass(
    new THREE.ShaderMaterial({
      ...(sampling ? { defines: sampling.defines } : {}),
      vertexShader: sampling ? POLAR_SHADOW_VERTEX : VERTEX,
      fragmentShader: sampling ? SHADOWED_FRAGMENT : FRAGMENT,
      uniforms: {
        uCookie: { value: cookie },
        uCookieEdgeFade: { value: edgeFade(cookie) },
        uColor: { value: new THREE.Vector3(color.r, color.g, color.b) },
        // Applied to the raw sRGB texels, Godot's canvas space: scaling a linear colour raises it
        // only by `energy^(1/2.2)` once re-encoded.
        uEnergy: { value: energy },
        ...(shadow ? shadowedLightUniforms(shadow.shadowColor) : {}),
        ...sampling?.uniforms,
      },
      // One pass, since `accumulationState` sums into the accumulator (`blendDst: OneFactor` for
      // ADD/SUB), so a fragment both facing passes covered would count this light twice.
      ...canvasItemFacing(),
      ...accumulationState(blendMode),
    })
  );
}
