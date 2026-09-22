/**
 * The quad a PointLight2D contributes to the canvas light accumulator.
 *
 * It emits Godot's `light_color` and nothing else:
 *
 *   rgb = cookie.rgb * light.color * energy      (sRGB, unclamped)
 *   a   = cookie.a
 *
 * `energy` is applied HERE, in sRGB, which is the space Godot's canvas works in
 * — scaling a linear colour instead raises it by only `energy^(1/2.2)` once
 * re-encoded, which is why lights read dim when the multiply is folded into a
 * linear material colour.
 *
 * The alpha is emitted RAW rather than pre-multiplied into rgb, because the
 * accumulator needs it twice over: as the blend factor that reproduces
 * `light_blend_compute` (below) and, summed across lights, as the coverage mask
 * a `light_mode = Light Only` item is drawn through.
 *
 * `light_blend_compute` in `canvas.glsl` is
 *
 *   ADD: S += light_color.rgb * light_color.a
 *   SUB: S -= light_color.rgb * light_color.a
 *   MIX: S  = mix(S, light_color.rgb, light_color.a)
 *
 * SHADOWS replace the whole term rather than dimming it. `canvas.glsl` does
 *
 *   shadow_color.a *= light_color.a;                  // .a is the cookie's
 *   light_color = mix(light_color, shadow_color, shadow);
 *
 * so a fully shadowed pixel takes `vec4(shadow_color.rgb, shadow_color.a *
 * cookie.a)`. At `Light2D`'s default `shadow_color = Color(0, 0, 0, 0)` the
 * whole term vanishes, which is why withholding the quad — a stencil test — IS
 * the shadow for almost every scene.
 *
 * An authored `shadow_color` is the same `mix` from its other side, so it is the
 * same quad drawn through the complementary stencil test: `createLightQuadMaterial`
 * covers where the volumes did NOT stamp, `createShadowColorQuadMaterial` covers
 * where they did. Together they partition the light's rect exactly once. The
 * second quad is skipped unless `shadowColorContributes`, so the default costs
 * nothing.
 *
 * UNDER `shadow_filter = PCF5/PCF13` the `mix` factor is a FRACTION and there is
 * no in/out to stencil, so both quads instead sample the light's polar shadow map
 * (`shadowPolarMap.ts`), cover the whole rect, and each emit their own share.
 * Expanding `canvas.glsl:502` with the albedo already folded into `C` (line 814
 * runs first) and `S = shadow_color`:
 *
 *   out += (C·(1−s) + S.rgb·s) · cookie.a·((1−s) + S.a·s)
 *        = C·(1−s)·cookie.a·((1−s) + S.a·s)      ← albedo-MULTIPLIED, the cookie quad
 *        + S.rgb·s·cookie.a·((1−s) + S.a·s)      ← albedo-FREE, the tint quad
 *
 * — no cross term, so the split across the two accumulators is exact rather than
 * approximate. At `s = 1` the tint term is `cookie.a · S.a`, byte-identical to
 * what the stencil path emits, and at Godot's transparent default the cookie term
 * collapses to the (1−s)² falloff MEASURED on Godot 4.6.3 (a PCF5 light over a
 * 0.25 surface steps 167/129/100/80/67/63 of 255, against the 167/146/…/64 a
 * plain (1−s) would give).
 *
 * and each of the three is exactly one fixed-function blend against the
 * accumulator, which is why all three are reproduced rather than approximated:
 * SrcAlpha/One with add, SrcAlpha/One with reverse-subtract, and
 * SrcAlpha/OneMinusSrcAlpha with add. Alpha always accumulates One/One, since
 * `light_only_alpha` is a plain sum (measured against Godot 4.6.3: one, two and
 * three overlapping cookies of alpha 0.3 mask to 0.3, 0.6 and 0.9, not to the
 * 0.51/0.657 a screen combination would give).
 *
 * The GLSL itself is in `lightQuadShaders.ts` and the filtered path's per-light
 * inputs in `shadowSampling.ts`; this module is the material assembly.
 *
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
 * One fixed-function blend per `Light2D.BlendMode`, against an accumulator whose
 * rgb holds `S` and whose alpha holds the summed cookie coverage.
 *
 * `transparent` is load-bearing rather than cosmetic: it is what puts the quads
 * in three's transparent list, which sorts farthest-first and so replays them in
 * canvas draw order. In the opaque list they would sort nearest-first, and MIX —
 * the one mode whose result depends on the order lights are applied — would come
 * out reversed.
 */
function accumulationBlend(blendMode: number): Partial<THREE.ShaderMaterialParameters> {
  return {
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
 * The `shadow_color` quad: one light's albedo-free term.
 *
 * The two mechanisms name the colour in different places, and the union is what
 * stops a light's two quads being built from two different colours. A FILTERED
 * light's colour rides its `ShadowSampling`, which the cookie quad reads for the
 * same light — one carrier, so the tint quad's rgb and the cookie quad's alpha
 * term are provably the same value rather than two that happen to agree. An
 * unfiltered light has no sampling, so it names the colour directly.
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
      /** `Light2D.shadow_color` — the whole colour, this quad's entire output. */
      readonly shadowColor: Color;
      /** The stencil test that confines it to where the volumes stamped. */
      readonly stencil?: LightQuadStencil;
    }
);

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
  /** Set for a filtered light, whose fraction replaces the stencil. */
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
      uEnergy: { value: energy },
      // Only `.a` is read on this side — it is what carries the shadowed half of
      // the alpha the accumulator sums for `light_only_alpha`.
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
    // Single pass is load-bearing rather than a saving here: `accumulationBlend`
    // SUMS into the accumulator (`blendDst: OneFactor` for ADD/SUB), so any
    // fragment both facing passes covered would count this light twice.
    ...canvasItemFacing(),
    ...accumulationBlend(blendMode),
    ...stencil,
  });
}
