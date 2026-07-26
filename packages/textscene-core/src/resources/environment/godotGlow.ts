/**
 * Godot `Environment` glow, as the numbers and the GLSL a compositor pass needs.
 *
 * A pure module (no three / React imports) so the arithmetic is unit-testable
 * and the shader source has one home. Ported from Godot 4.6's
 * `servers/rendering/renderer_rd/shaders/effects/{copy,tonemap}.glsl`, used under
 * the MIT licence — see THIRD-PARTY-NOTICES.md.
 *
 * Three pieces of Godot's pipeline live here, because all three have to agree
 * for a halo to land where Godot puts it:
 *
 * 1. THE BRIGHT PASS. Godot gates on the PEAK RGB channel, not Rec. 709
 *    luminance — a saturated blue emissive is the dimmest surface in the frame
 *    by luminance and still blooms. The knee is a `smoothstep` across
 *    `[threshold, threshold + hdr_scale]`, `glow_bloom` is a FLOOR on the result
 *    (at 1.0 every pixel glows, however dark), and the whole thing multiplies
 *    the colour rather than subtracting the threshold from it.
 *
 * 2. THE PYRAMID. Seven mip levels, each with its own weight, summed
 *    UNNORMALISED. The defaults — `[0, 0.8, 0.4, 0.1, 0, 0, 0]` — are what makes
 *    a Godot halo tight: the finest mip is off and nothing past the fourth
 *    contributes at all. An equal-weighted 8-level pyramid instead spreads a
 *    haze over the whole frame, which is the failure this replaces.
 *
 * 3. THE BLEND, and WHERE it happens. Godot composites glow at two different
 *    points depending on the mode: SOFTLIGHT after the tone curve (with the glow
 *    buffer itself tonemapped), every other mode into linear HDR before it. Both
 *    orderings are expressed here so a scene picks its own.
 */

import type { EnvironmentSettings } from './renderer';
import { glslFloat } from './glslLiterals';

/** Godot `Environment.GlowBlendMode`. */
export const GlowBlendMode = {
  ADDITIVE: 0,
  SCREEN: 1,
  SOFTLIGHT: 2,
  REPLACE: 3,
  MIX: 4,
} as const;

export interface GlowParams {
  /** The seven mip weights, finest first. Godot sums these unnormalised. */
  levels: number[];
  /** Highest level index carrying weight — mips past it are never rendered. */
  maxLevel: number;
  /** Peak HDR channel where the bright-pass knee starts. */
  hdrThreshold: number;
  /** Knee width above the threshold. */
  hdrScale: number;
  /** Floor on the bright-pass feedback, 0..1. */
  bloom: number;
  /** Per-channel ceiling on the bright-pass result. */
  luminanceCap: number;
  /** Per-pass multiplier on the glow buffer. */
  strength: number;
  /**
   * Multiplies the gathered glow just before the blend. MIX takes `glow_mix`
   * here instead of `glow_intensity` — Godot fills the same shader uniform from
   * whichever of the two the mode uses, so they are never both live.
   */
  intensity: number;
  blendMode: number;
}

/**
 * Godot skips a level whose weight is at or below this, so a level under it
 * contributes nothing and need not be rendered.
 */
const LEVEL_EPSILON = 0.0001;

/**
 * `null` when this environment has no glow, so a caller can decide purely from
 * the settings whether to mount the post-process at all.
 */
export function glowParamsFor(settings: EnvironmentSettings): GlowParams | null {
  const glow = settings.glow;
  if (!glow) return null;

  const levels = glow.levels;
  let maxLevel = -1;
  for (let i = 0; i < levels.length; i++) {
    if ((levels[i] ?? 0) > LEVEL_EPSILON) maxLevel = i;
  }

  const blendMode = glow.blendMode;
  return {
    levels,
    maxLevel,
    hdrThreshold: Math.max(0, glow.hdrThreshold),
    hdrScale: Math.max(0, glow.hdrScale),
    bloom: clamp01(glow.bloom),
    luminanceCap: Math.max(0, glow.luminanceCap),
    strength: Math.max(0, glow.strength),
    intensity: blendMode === GlowBlendMode.MIX ? glow.mix : glow.intensity,
    blendMode,
  };
}

/**
 * Whether this glow changes the frame everywhere, so a consumer cannot decide
 * from the scene's contents whether to run it.
 *
 * Skipping the pass when nothing is bright enough to bloom is safe only while the
 * glow is additive-ish AND gated above the range lit surfaces occupy. Three
 * things break that:
 *
 *   - `glow_bloom` above zero FLOORS the bright-pass feedback, so every pixel
 *     enters the glow buffer however dark it is.
 *   - REPLACE discards the scene colour outright and MIX lerps toward the glow,
 *     so both rewrite every pixel even when the glow buffer is black.
 *   - a threshold below 1 catches ordinary lit surfaces, which the emissive scan
 *     never examines — it only ever looks at materials' emission.
 */
export function glowNeedsEveryPixel(params: GlowParams): boolean {
  return (
    params.bloom > 0 ||
    params.blendMode === GlowBlendMode.REPLACE ||
    params.blendMode === GlowBlendMode.MIX ||
    params.hdrThreshold < 1
  );
}

/**
 * Whether the blend runs on tonemapped operands rather than on linear HDR before
 * the tone curve. Godot splits on this: SOFTLIGHT composites after the curve
 * (with the glow buffer itself tonemapped) so its polynomial sees operands in the
 * range it is anchored for; every other mode composites before it.
 */
export function blendsAfterToneMapping(params: GlowParams): boolean {
  return params.blendMode === GlowBlendMode.SOFTLIGHT;
}

/**
 * The level weights with `glow_strength` already folded in.
 *
 * Godot multiplies the glow buffer by `glow_strength` at EVERY pyramid pass, so
 * a level that has been through `n` passes carries `strength^n` — level `i` is
 * reached by the bright pass plus `i` downsamples, hence `strength^(i+1)`. Doing
 * that on the CPU is exactly equivalent to multiplying per pass on the GPU, and
 * it keeps the whole of `glow_strength`'s behaviour (including that it compounds,
 * which is why values above 1 grow so fast) in a place a unit test can read.
 */
export function effectiveLevelWeights(params: GlowParams): number[] {
  return params.levels.map((weight, index) => weight * Math.pow(params.strength, index + 1));
}

/**
 * Godot's bright pass (`copy.glsl`, `MODE_GLOW` under `FLAG_GLOW_FIRST_PASS`).
 * Emits `godotGlowBrightPass(vec3) -> vec3`; the thresholds are baked as
 * constants because a change to any of them rebuilds the pass anyway.
 */
export function brightPassGlsl(params: GlowParams): string {
  return /* glsl */ `
vec3 godotGlowBrightPass(vec3 color) {
  float luminance = max(color.r, max(color.g, color.b));
  float feedback = max(
    smoothstep(${glslFloat(params.hdrThreshold)}, ${glslFloat(
      params.hdrThreshold + params.hdrScale
    )}, luminance),
    ${glslFloat(params.bloom)}
  );
  return min(color * feedback, vec3(${glslFloat(params.luminanceCap)}));
}
`;
}

/**
 * Godot's `apply_glow` (`tonemap.glsl`), specialised to one blend mode so no
 * branch survives into the shader. `white` is the tonemapper's white point,
 * which SCREEN normalises against.
 *
 * SOFTLIGHT is the W3C soft-light `D()` function — `((16c - 12)c + 4)c` below
 * 0.25, `sqrt(c)` above — applied as `color + glow * (D(color) - color)`, and
 * left alone entirely above 1.0 where the curve would invert.
 */
export function blendGlsl(params: GlowParams, white: number): string {
  // A mode whose value is outside the enum falls back to ADDITIVE: `glow_blend_mode`
  // is parsed leniently, so a scene can carry anything.
  const body = BLEND_BODIES[params.blendMode] ?? BLEND_BODIES[GlowBlendMode.ADDITIVE]!;
  return /* glsl */ `
vec3 godotGlowBlend(vec3 color, vec3 glow) {
${body(params, white)}
}
`;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

const SOFTLIGHT_CHANNEL = (channel: string): string => /* glsl */ `
  color.${channel} = color.${channel} > 1.0
    ? color.${channel}
    : color.${channel} + glow.${channel} * ((color.${channel} <= 0.25
        ? ((16.0 * color.${channel} - 12.0) * color.${channel} + 4.0) * color.${channel}
        : sqrt(color.${channel})) - color.${channel});`;

/**
 * One body per mode, each interpolating only the constants it actually reads —
 * so an ADDITIVE shader is a single line rather than one line under two unused
 * declarations.
 */
const BLEND_BODIES: Record<number, (params: GlowParams, white: number) => string> = {
  [GlowBlendMode.ADDITIVE]: () => /* glsl */ `  return color + glow;`,

  // Screen, normalised to the white range and back — Godot ships the simplified
  // form, and clamps the glow to `white` because a negative light can drive the
  // buffer below zero.
  [GlowBlendMode.SCREEN]: (_params, white) => /* glsl */ `  glow = clamp(glow, 0.0, ${glslFloat(white)});
  return color + glow - (color * glow / ${glslFloat(white)});`,

  [GlowBlendMode.SOFTLIGHT]: () => /* glsl */ `  glow = clamp(glow, 0.0, 1.0);
${SOFTLIGHT_CHANNEL('r')}
${SOFTLIGHT_CHANNEL('g')}
${SOFTLIGHT_CHANNEL('b')}
  return color;`,

  [GlowBlendMode.REPLACE]: () => /* glsl */ `  return glow;`,

  // Godot's MIX reuses the intensity slot for `glow_mix`, so `params.intensity`
  // IS the lerp factor and has already been multiplied into `glow` by the time
  // this runs — hence lerping against that same value rather than a second one.
  [GlowBlendMode.MIX]: (params) => /* glsl */ `  return color * (1.0 - ${glslFloat(
    clamp01(params.intensity)
  )}) + glow;`,
};
