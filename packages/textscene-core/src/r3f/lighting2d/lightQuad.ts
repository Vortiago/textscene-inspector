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
import {
  FRAGMENT,
  SHADOW_SAMPLE,
  SHADOW_VERTEX,
  SHADOWED_FRAGMENT,
  SHADOWED_TINT_FRAGMENT,
  VERTEX,
} from './lightQuadShaders.js';
import { shadowSamplingParameters, type ShadowSampling } from './shadowSampling.js';
import type { Rgba } from '../../godot/math/math.js';
import { Light2DBlendMode, Light2DShadowFilter } from '../../godot/scene/light2d.js';

export { updateShadowPolarTexture, type ShadowSampling } from './shadowSampling.js';

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

/** The colour with its rgb zeroed: a quad of it carries only its alpha, the factor MIX scales by. */
export function alphaOnly(color: Rgba): Rgba {
  return { r: 0, g: 0, b: 0, a: color.a };
}

/** The `shadow_color` quad: one light's albedo-free term. */
interface ShadowColorQuadOptions {
  readonly cookie: THREE.Texture;
  readonly blendMode: number;
  /** The light's shadow, whose colour the cookie quad reads too, so both quads use one value. */
  readonly shadow: ShadowSampling;
}

/**
 * `canvas.glsl:543-547` replaces the term: `light_color = mix(light_color, shadow_color, shadow)`,
 * after `shadow_color.a *= light_color.a`. This quad carries the albedo-free half, and is skipped
 * unless `shadowColorContributes` or the light blends by MIX.
 */
export function createShadowColorQuadMaterial({
  cookie,
  blendMode,
  shadow,
}: ShadowColorQuadOptions): THREE.ShaderMaterial {
  const sampling = shadowSamplingParameters(shadow);
  return new THREE.ShaderMaterial({
    defines: sampling.defines,
    vertexShader: SHADOW_VERTEX,
    fragmentShader: SHADOW_SAMPLE + SHADOWED_TINT_FRAGMENT,
    uniforms: {
      uCookie: { value: cookie },
      uCookieEdgeFade: { value: edgeFade(cookie) },
      uShadowColor: { value: shadowColorUniform(shadow.shadowColor) },
      ...sampling.uniforms,
    },
    ...canvasItemFacing(),
    ...accumulationState(blendMode),
  });
}

/** `Light2D.shadow_color` as the `uShadowColor` every shadowed light quad reads. */
export function shadowColorUniform({ r, g, b, a }: Rgba): THREE.Vector4 {
  return new THREE.Vector4(r, g, b, a);
}

/** 1 for a linear cookie tap, which blends toward the transparent atlas border; 0 for a nearest tap. */
function edgeFade(cookie: THREE.Texture): number {
  return cookie.magFilter === THREE.NearestFilter ? 0 : 1;
}

/** The cookie quad: one light's albedo-multiplied term. */
interface LightQuadOptions {
  readonly cookie: THREE.Texture;
  /** `Light2D.color`. */
  readonly color: Rgba;
  /** `Light2D.energy`. */
  readonly energy: number;
  readonly blendMode: number;
  /**
   * Set for a shadowed light: both its quads sample the polar map (`shadowPolarMap.ts`) over the
   * whole rect, each emitting its share of `canvas.glsl:547`.
   */
  readonly shadow?: ShadowSampling;
}

export function createLightQuadMaterial({
  cookie,
  color,
  energy,
  blendMode,
  shadow,
}: LightQuadOptions): THREE.ShaderMaterial {
  const sampling = shadow ? shadowSamplingParameters(shadow) : null;
  return new THREE.ShaderMaterial({
    ...(sampling ? { defines: sampling.defines } : {}),
    vertexShader: sampling ? SHADOW_VERTEX : VERTEX,
    fragmentShader: sampling ? SHADOW_SAMPLE + SHADOWED_FRAGMENT : FRAGMENT,
    uniforms: {
      uCookie: { value: cookie },
      uCookieEdgeFade: { value: edgeFade(cookie) },
      uColor: { value: new THREE.Vector3(color.r, color.g, color.b) },
      // Applied to the raw sRGB texels, Godot's canvas space: scaling a linear colour raises it
      // only by `energy^(1/2.2)` once re-encoded.
      uEnergy: { value: energy },
      // Only `.a` is read on this side: the shadowed half of the alpha the accumulator sums for
      // `light_only_alpha`.
      ...(shadow ? { uShadowColor: { value: shadowColorUniform(shadow.shadowColor) } } : {}),
      ...sampling?.uniforms,
    },
    // One pass, since `accumulationState` sums into the accumulator (`blendDst: OneFactor` for
    // ADD/SUB), so a fragment both facing passes covered would count this light twice.
    ...canvasItemFacing(),
    ...accumulationState(blendMode),
  });
}
