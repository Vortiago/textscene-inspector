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
import { toneMappingEffectGlsl } from './godotToneMapping';

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
 * How much smaller than the frame glow level 0 is.
 *
 * Godot allocates its glow buffer at half the internal render size, and the
 * gather pass then writes level 0 at half of THAT — it box-samples straight to
 * quarter resolution rather than stepping down one level at a time. So every
 * level sits one octave coarser than a half-resolution chain would put it, which
 * is why a halo built on the coarse levels reads wide and flat in Godot rather
 * than tight and bright. A chain that starts an octave too fine is wrong by a
 * whole level at every rung, so it misses by far more than a tuning error would.
 */
export const GLOW_FIRST_LEVEL_DIVISOR = 4;

/**
 * The pixel size of one glow level, given the frame it is built from. Each level
 * halves again from `GLOW_FIRST_LEVEL_DIVISOR`, and never collapses below 1px —
 * a zero-sized render target is not renderable.
 */
export function glowLevelSize(
  width: number,
  height: number,
  level: number
): { width: number; height: number } {
  const divisor = GLOW_FIRST_LEVEL_DIVISOR * Math.pow(2, level);
  return {
    width: Math.max(1, Math.floor(width / divisor)),
    height: Math.max(1, Math.floor(height / divisor)),
  };
}

/**
 * `null` when this environment cannot glow, so a caller can decide purely from
 * the settings whether to mount the post-process at all.
 *
 * A pyramid whose every weight is at or below the cutoff produces nothing no
 * matter what else is set, so it reads as "no glow" here rather than as params
 * with an empty pyramid — which is what lets a consumer treat a non-null result
 * as having a real `maxLevel` instead of promising it across files.
 */
export function glowParamsFor(settings: EnvironmentSettings): GlowParams | null {
  const glow = settings.glow;
  if (!glow) return null;

  const levels = glow.levels;
  let maxLevel = -1;
  for (let i = 0; i < levels.length; i++) {
    if ((levels[i] ?? 0) > LEVEL_EPSILON) maxLevel = i;
  }

  if (maxLevel < 0) return null;

  const blendMode = glow.blendMode;
  return {
    levels,
    maxLevel,
    hdrThreshold: Math.max(0, glow.hdrThreshold),
    hdrScale: Math.max(0, glow.hdrScale),
    bloom: clamp01(glow.bloom),
    luminanceCap: Math.max(0, glow.luminanceCap),
    strength: Math.max(0, glow.strength),
    intensity: blendMode === GlowBlendMode.MIX ? clamp01(glow.mix) : glow.intensity,
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
 * The peak `emissive * emissiveIntensity` a material must exceed for the pass to
 * be worth mounting — the bright pass's threshold, moved into the space a scene
 * scan can actually measure.
 *
 * A scan reads live materials, whose emissive carries no exposure; the bright pass
 * multiplies by `tonemap_exposure` BEFORE comparing against `glow_hdr_threshold`.
 * So the two only agree if the threshold is scaled down by the same exposure.
 * Comparing the raw value instead silently leaves the compositor unmounted for any
 * scene lifted over the threshold by exposure alone, and the frame renders with no
 * halo whatsoever rather than a slightly wrong one.
 */
export function bloomableScanThreshold(params: GlowParams, exposure: number): number {
  return params.hdrThreshold / Math.max(exposure, GLSL_EPSILON);
}

/**
 * The gather weights, which are the authored ones unchanged.
 *
 * `glow_strength` is NOT folded in here. Godot multiplies by it once per pyramid
 * pass, and on the first pass that multiply lands before the knee and the
 * luminance cap — so folding it into the gather would move it after both, and a
 * strength above 1 could then carry a level past a cap Godot had already
 * clamped. The bright pass and each downsample apply it instead, which reaches
 * the same total (`strength^(i+1)` at level `i`) in the right order.
 */
export function gatherWeights(params: GlowParams): number[] {
  return params.levels.slice();
}

/**
 * Godot's bright pass (`copy.glsl`, `MODE_GLOW` under `FLAG_GLOW_FIRST_PASS`).
 *
 * Order is load-bearing and is Godot's: `glow_strength` then `glow_exposure`
 * multiply the colour BEFORE the knee is evaluated and before the luminance cap
 * clamps it. Folding either in afterwards changes which pixels cross the
 * threshold and lets a level exceed a cap Godot would have applied — the
 * magnitude can come out the same while the halo's extent does not.
 * `glow_exposure` is the Environment's own `tonemap_exposure`
 * (`renderer_scene_render_rd.cpp` passes `environment_get_exposure`), which is
 * why the composite must not apply exposure to the glow a second time.
 */
export function brightPassGlsl(params: GlowParams, exposure: number): string {
  const kneeEnd = params.hdrThreshold + Math.max(params.hdrScale, GLSL_EPSILON);
  return /* glsl */ `
vec3 godotGlowBrightPass(vec3 color) {
  color *= ${glslFloat(params.strength)};
  color *= ${glslFloat(exposure)};
  float luminance = max(color.r, max(color.g, color.b));
  float feedback = max(
    smoothstep(${glslFloat(params.hdrThreshold)}, ${glslFloat(kneeEnd)}, luminance),
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

/**
 * The whole composite, in `tonemap.glsl`'s order — the glow gather, the blend, and
 * the tone curve in one shader, which is how Godot ships it.
 *
 * Exposure is the subtle part. Godot applies it to the SCENE colour once, before
 * the blend (`color.rgb *= exposure` near the top of `main()`), while the GLOW
 * buffer was already exposed by the bright pass. So the tone curve here is invoked
 * with an exposure of 1.0: it is the curve alone, and each operand has been exposed
 * exactly once. Multiplying by exposure again would double it on the glow and, on
 * the pre-tonemap path, scale the blended sum instead of its operands.
 */
export function compositeGlsl(
  params: GlowParams,
  toneMapping: { mode: number; exposure: number; white: number }
): string {
  const blend = blendsAfterToneMapping(params)
    ? /* glsl */ `  vec3 color = godotToneMap(max(inputColor.rgb, 0.0) * godotExposure, 1.0);
  color = godotGlowBlend(color, godotToneMap(glow, 1.0));`
    : /* glsl */ `  vec3 color = godotGlowBlend(max(inputColor.rgb, 0.0) * godotExposure, glow);
  color = godotToneMap(color, 1.0);`;

  return /* glsl */ `
uniform sampler2D godotGlowBuffer;
uniform float godotExposure;
${toneMappingEffectGlsl(toneMapping.mode, toneMapping.white)}
${blendGlsl(params, toneMapping.white)}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 glow = texture2D(godotGlowBuffer, uv).rgb * ${glslFloat(params.intensity)};
${blend}
  outputColor = vec4(color, inputColor.a);
}
`;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Smallest value safe to bake where GLSL will divide by it or use it as a
 * smoothstep edge. `smoothstep(e, e, x)` divides by `e1 - e0` and is undefined at
 * zero width; SCREEN divides by the white point. Godot's own comment says white
 * "cannot be smaller than the maximum output value", so zero is outside its
 * contract rather than a case it handles — but a scene can still author it.
 */
const GLSL_EPSILON = 1e-4;

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
  [GlowBlendMode.SCREEN]: (_params, white) => {
    const safeWhite = glslFloat(Math.max(white, GLSL_EPSILON));
    return /* glsl */ `  glow = clamp(glow, 0.0, ${safeWhite});
  return color + glow - (color * glow / ${safeWhite});`;
  },

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
    params.intensity
  )}) + glow;`,
};
