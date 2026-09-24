/**
 * The quad materials a PointLight2D adds to the canvas light accumulator: Godot's `light_color`,
 * `rgb = cookie.rgb * color * energy` in sRGB and unclamped, and `a = cookie.a` raw, since the alpha
 * is both the blend factor and, summed, the Light Only mask. The GLSL is in `lightQuadShaders.ts`.
 */
/*
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import * as THREE from 'three';
import type { Color } from '../../nodes/base/node2d/types.js';
import { canvasItemFacing } from '../canvasItemFacing.js';
import {
  FRAGMENT,
  SHADOW_FRAGMENT,
  SHADOW_SAMPLE,
  SHADOW_VERTEX,
  SHADOWED_FRAGMENT,
  SHADOWED_TINT_FRAGMENT,
  VERTEX,
} from './lightQuadShaders.js';
import { shadowSamplingParameters, type ShadowSampling } from './shadowSampling.js';

export {
  createShadowPolarTexture,
  shadowPixelSize,
  updateShadowPolarTexture,
  type ShadowSampling,
} from './shadowSampling.js';

/** Godot `Light2D.BlendMode`. */
export enum Light2DBlendMode {
  ADD = 0,
  SUB = 1,
  MIX = 2,
}

/** Godot `Light2D.ShadowFilter`. NONE keeps the stencil path; the rest sample the map. */
export const SHADOW_FILTER_NONE = 0;
export const SHADOW_FILTER_PCF5 = 1;
export const SHADOW_FILTER_PCF13 = 2;

/**
 * `light_blend_compute`'s modes are one fixed-function blend each: ADD is SrcAlpha/One with add,
 * SUB the same with reverse-subtract, and MIX SrcAlpha/OneMinusSrcAlpha with add. Alpha adds
 * One/One: Godot 4.6.3 sums `light_only_alpha`, so one, two and three 0.3 cookies mask to 0.3, 0.6
 * and 0.9, not a screen blend's 0.51 and 0.657.
 */
function accumulationBlend(blendMode: number): Partial<THREE.ShaderMaterialParameters> {
  return {
    // The transparent list sorts farthest-first, replaying canvas draw order. The opaque list
    // sorts nearest-first and would reverse MIX, whose result depends on light order.
    transparent: true,
    blending: THREE.CustomBlending,
    blendEquation:
      blendMode === Light2DBlendMode.SUB ? THREE.ReverseSubtractEquation : THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst:
      blendMode === Light2DBlendMode.MIX ? THREE.OneMinusSrcAlphaFactor : THREE.OneFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneFactor,
  };
}

/**
 * Stencil state for a light quad, spread verbatim onto the material.
 * `litQuadStencilProps` for a shadowed light, empty for one that casts nothing.
 */
export type LightQuadStencil = Partial<THREE.ShaderMaterialParameters>;

/**
 * Whether a `shadow_color` puts anything into the accumulator. Alpha is the
 * whole test: it multiplies the term twice over (once as the blend factor, once
 * as `shadow_color.a`), so a transparent colour contributes nothing whatever its
 * rgb, and Godot's default is exactly that.
 */
export function shadowColorContributes(shadowColor: Color): boolean {
  return shadowColor.a > 0;
}

/**
 * The `shadow_color` quad: one light's albedo-free term. A filtered light's colour rides its
 * `ShadowSampling`, which the cookie quad reads too, so both quads provably use one value. An
 * unfiltered light has no sampling and names the colour directly.
 */
export type ShadowColorQuadOptions = {
  readonly cookie: THREE.Texture;
  readonly blendMode: number;
} & (
  | {
      readonly shadow: ShadowSampling;
      readonly shadowColor?: never;
      readonly stencil?: never;
    }
  | {
      readonly shadow?: undefined;
      /** `Light2D.shadow_color`: this quad's entire output. */
      readonly shadowColor: Color;
      /** The stencil test that confines it to where the volumes stamped. */
      readonly stencil?: LightQuadStencil;
    }
);

/**
 * `canvas.glsl` replaces the term: `light_color = mix(light_color, shadow_color, shadow)`, after
 * `shadow_color.a *= light_color.a`. The default transparent colour makes withholding the lit quad
 * the whole shadow. An authored colour draws this quad through the complementary stencil test, so
 * the pair covers the rect once. It is skipped unless `shadowColorContributes`.
 */
export function createShadowColorQuadMaterial(
  options: ShadowColorQuadOptions
): THREE.ShaderMaterial {
  const { cookie, blendMode, shadow } = options;
  const shadowColor = shadow ? shadow.shadowColor : options.shadowColor;
  const stencil = shadow ? undefined : options.stencil;
  const sampling = shadow ? shadowSamplingParameters(shadow) : null;
  return new THREE.ShaderMaterial({
    ...(sampling ? { defines: sampling.defines } : {}),
    vertexShader: sampling ? SHADOW_VERTEX : VERTEX,
    fragmentShader: sampling ? SHADOW_SAMPLE + SHADOWED_TINT_FRAGMENT : SHADOW_FRAGMENT,
    uniforms: {
      uCookie: { value: cookie },
      uShadowColor: {
        value: new THREE.Vector4(shadowColor.r, shadowColor.g, shadowColor.b, shadowColor.a),
      },
      ...sampling?.uniforms,
    },
    depthWrite: false,
    depthTest: false,
    ...canvasItemFacing(),
    ...accumulationBlend(blendMode),
    ...stencil,
  });
}

/** The cookie quad: one light's albedo-multiplied term. */
export interface LightQuadOptions {
  readonly cookie: THREE.Texture;
  /** `Light2D.color`. */
  readonly color: Color;
  /** `Light2D.energy`. */
  readonly energy: number;
  readonly blendMode: number;
  /** The stencil test that withholds it where the volumes stamped. */
  readonly stencil?: LightQuadStencil;
  /**
   * Set for a PCF5/PCF13 light: its shadow is a fraction with no in or out to stencil, so both quads
   * sample the polar map (`shadowPolarMap.ts`) over the whole rect, each emitting its share of
   * `canvas.glsl:502`.
   */
  readonly shadow?: ShadowSampling;
}

export function createLightQuadMaterial({
  cookie,
  color,
  energy,
  blendMode,
  stencil,
  shadow,
}: LightQuadOptions): THREE.ShaderMaterial {
  const sampling = shadow ? shadowSamplingParameters(shadow) : null;
  return new THREE.ShaderMaterial({
    ...(sampling ? { defines: sampling.defines } : {}),
    vertexShader: sampling ? SHADOW_VERTEX : VERTEX,
    fragmentShader: sampling ? SHADOW_SAMPLE + SHADOWED_FRAGMENT : FRAGMENT,
    uniforms: {
      uCookie: { value: cookie },
      uColor: { value: new THREE.Vector3(color.r, color.g, color.b) },
      // Applied in sRGB, Godot's canvas space: scaling a linear colour raises it only by
      // `energy^(1/2.2)` once re-encoded.
      uEnergy: { value: energy },
      // Only `.a` is read on this side: the shadowed half of the alpha the accumulator sums for
      // `light_only_alpha`.
      ...(shadow
        ? {
            uShadowColor: {
              value: new THREE.Vector4(
                shadow.shadowColor.r,
                shadow.shadowColor.g,
                shadow.shadowColor.b,
                shadow.shadowColor.a
              ),
            },
          }
        : {}),
      ...sampling?.uniforms,
    },
    depthWrite: false,
    depthTest: false,
    // One pass, since `accumulationBlend` sums into the accumulator (`blendDst: OneFactor` for
    // ADD/SUB), so a fragment both facing passes covered would count this light twice.
    ...canvasItemFacing(),
    ...accumulationBlend(blendMode),
    ...stencil,
  });
}
