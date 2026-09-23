/**
 * Godot `Environment` glow: the bright pass, the mip pyramid and the blend, which
 * must agree for a halo to land where Godot puts it. Ported from Godot 4.6's
 * `servers/rendering/renderer_rd/shaders/effects/{copy,tonemap}.glsl`, used under
 * the MIT licence (see THIRD-PARTY-NOTICES.md). Pure, so the arithmetic is testable.
 */

import type { EnvironmentSettings } from './types';
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
  /**
   * The seven mip weights, finest first, as authored, summed unnormalised. The
   * defaults `[0, 0.8, 0.4, 0.1, 0, 0, 0]` keep a Godot halo tight: the finest mip
   * is off and nothing past the fourth contributes. An equal-weighted pyramid
   * spreads a haze over the whole frame.
   */
  levels: number[];
  /** Highest level index carrying weight. Mips past it are never rendered. */
  maxLevel: number;
  /** Peak HDR channel where the bright-pass knee starts. */
  hdrThreshold: number;
  /** Knee width above the threshold. */
  hdrScale: number;
  /** Floor on the bright-pass feedback, 0..1. */
  bloom: number;
  /** Per-channel ceiling on the bright-pass result. */
  luminanceCap: number;
  /**
   * Per-pass multiplier on the glow buffer, applied by the bright pass and each
   * downsample, not folded into `levels`. On the first pass Godot multiplies before
   * the knee and the luminance cap, so a folded strength above 1 could carry a
   * level past a cap Godot had already clamped.
   */
  strength: number;
  /**
   * Multiplies the gathered glow just before the blend. MIX takes `glow_mix` here
   * instead of `glow_intensity`: Godot fills the same shader uniform from whichever
   * of the two the mode uses, so they are never both live.
   */
  intensity: number;
  blendMode: number;
  /**
   * The Environment's `tonemap_exposure`, a glow input: `renderer_scene_render_rd.cpp`
   * passes `environment_get_exposure` as `glow_exposure`, and the bright pass applies
   * it before the knee. It lives here so the bright pass and code upstream of it read
   * one value, and the composite must not apply it to the glow a second time.
   */
  exposure: number;
}

/**
 * Godot skips a level whose weight is at or below this, so a level under it
 * contributes nothing and need not be rendered.
 */
const LEVEL_EPSILON = 0.0001;

/**
 * How much smaller than the frame glow level 0 is. Godot allocates its glow buffer
 * at half the render size, and the gather pass box-samples level 0 at half of that.
 * A chain that starts at half resolution is one octave too fine at every level, so
 * its halo reads tight and bright where Godot's reads wide and flat.
 */
const GLOW_FIRST_LEVEL_DIVISOR = 4;

/**
 * The pixel size of one glow level, given the frame it is built from. Each level
 * halves again from `GLOW_FIRST_LEVEL_DIVISOR`, and never falls below 1px, since a
 * zero-sized render target is not renderable.
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
 * `null` when this environment cannot glow, so a caller decides from the settings
 * whether to mount the post-process. A pyramid with every weight at or below the
 * cutoff produces nothing, so it is `null` too: a non-null result always has a
 * real `maxLevel`.
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
    exposure: settings.toneMapping.exposure,
  };
}

/**
 * Whether this glow changes the frame everywhere, so a consumer cannot skip it when
 * nothing in the scene is bright enough to bloom.
 */
export function glowNeedsEveryPixel(params: GlowParams): boolean {
  return (
    // `glow_bloom` floors the bright-pass feedback, so every pixel enters the buffer.
    params.bloom > 0 ||
    // REPLACE and MIX rewrite every pixel even when the glow buffer is black.
    params.blendMode === GlowBlendMode.REPLACE ||
    params.blendMode === GlowBlendMode.MIX ||
    // Below 1 it catches lit surfaces, and the emissive scan reads only emission.
    params.hdrThreshold < 1
  );
}

/**
 * Whether the blend runs on tonemapped operands rather than on linear HDR. Godot
 * composites SOFTLIGHT after the curve, with the glow buffer tonemapped too, so its
 * polynomial sees the range it is anchored for. Every other mode composites before.
 */
export function blendsAfterToneMapping(params: GlowParams): boolean {
  return params.blendMode === GlowBlendMode.SOFTLIGHT;
}

/**
 * `glow_hdr_threshold` restated for unexposed colour. The bright pass multiplies by
 * `glow_exposure` before the comparison, so code that inspects colour upstream of it
 * needs this bar, or it disagrees with the shader about what blooms.
 */
export function unexposedBrightPassThreshold(params: GlowParams): number {
  return params.hdrThreshold / Math.max(params.exposure, GLSL_EPSILON);
}

/**
 * Godot's bright pass (`copy.glsl`, `MODE_GLOW` under `FLAG_GLOW_FIRST_PASS`). It
 * gates on the peak RGB channel, not Rec. 709 luminance, so a saturated blue emissive
 * still blooms. It multiplies the colour by the knee rather than subtracting the
 * threshold, and `glow_bloom` floors the knee: at 1.0 every pixel glows.
 */
export function brightPassGlsl(params: GlowParams): string {
  // Godot's order: strength and exposure multiply before the knee and the cap.
  // Applied afterwards, they change which pixels cross the threshold and let a
  // level exceed a cap Godot would have applied.
  const kneeEnd = params.hdrThreshold + Math.max(params.hdrScale, GLSL_EPSILON);
  return /* glsl */ `
vec3 godotGlowBrightPass(vec3 color) {
  color *= ${glslFloat(params.strength)};
  color *= ${glslFloat(params.exposure)};
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
 * Godot's `apply_glow` (`tonemap.glsl`), specialised to one blend mode so no branch
 * survives into the shader. `white` is the tonemapper's white point, which SCREEN
 * normalises against. `godotCompositor.ts` joins a blend to a curve, so asking
 * whether an environment glows loads no tone-curve body.
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

/**
 * Smallest value safe to bake where GLSL divides by it: `smoothstep(e, e, x)` is
 * undefined at zero width, and SCREEN divides by the white point, which a scene can
 * author as zero. Not `LEVEL_EPSILON`, though equal: that is Godot's weight cutoff,
 * and merging them couples a parity value to a codegen guard.
 */
const GLSL_EPSILON = 1e-4;

/**
 * The W3C soft-light `D()`: `((16c - 12)c + 4)c` below 0.25, `sqrt(c)` above,
 * applied as `color + glow * (D(color) - color)`. A channel above 1.0 is left
 * alone, where the curve would invert.
 */
const SOFTLIGHT_CHANNEL = (channel: string): string => /* glsl */ `
  color.${channel} = color.${channel} > 1.0
    ? color.${channel}
    : color.${channel} + glow.${channel} * ((color.${channel} <= 0.25
        ? ((16.0 * color.${channel} - 12.0) * color.${channel} + 4.0) * color.${channel}
        : sqrt(color.${channel})) - color.${channel});`;

/** One body per mode, each interpolating only the constants it reads. */
const BLEND_BODIES: Record<number, (params: GlowParams, white: number) => string> = {
  [GlowBlendMode.ADDITIVE]: () => /* glsl */ `  return color + glow;`,

  // Screen normalised to the white range and back, in Godot's simplified form. It
  // clamps the glow to `white` because a negative light can drive the buffer below zero.
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

  // `params.intensity` holds `glow_mix`, the lerp factor, and is already multiplied
  // into `glow`, so the lerp uses that same value.
  [GlowBlendMode.MIX]: (params) => /* glsl */ `  return color * (1.0 - ${glslFloat(
    params.intensity
  )}) + glow;`,
};
