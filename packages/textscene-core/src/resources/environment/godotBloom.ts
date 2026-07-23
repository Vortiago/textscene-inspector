/**
 * Godot `Environment` glow → `postprocessing` `BloomEffect` parameters.
 *
 * A pure mapping (no three/React imports) so it is unit-testable and shared by
 * whatever mounts the bloom pass. The mapping is *defensible, not exact*: Godot
 * runs a 7-level HDR bright-pass with a SOFTLIGHT blend by default, while the
 * `BloomEffect` is a single mip-blurred additive/screen bloom. The knobs that
 * carry over cleanly are the ones that matter for the visible gap — the HDR
 * threshold, the additive strength, and the blur spread.
 *
 * Godot's glow is computed on **pre-tonemap HDR** and its threshold gates on
 * the PEAK RGB channel (`GlowLayer` rewrites the `BloomEffect` bright-pass to
 * match — a saturated emissive with peak > 1 blooms even though its Rec. 709
 * luminance is well below 1). So `luminanceThreshold` here is a peak-channel
 * threshold, and the consumer MUST run bloom before tonemapping (the composer
 * renders the scene to a linear HDR target with the renderer's own tonemapping
 * disabled, which is exactly that ordering — see `GlowLayer`).
 */

import type { EnvironmentSettings } from './renderer';

export interface BloomParams {
  /** `BloomEffect.luminanceThreshold` — peak HDR channel a pixel must exceed. */
  luminanceThreshold: number;
  /** `BloomEffect.luminanceSmoothing` — soft knee around the threshold. */
  luminanceSmoothing: number;
  /** `BloomEffect.intensity` — additive strength of the glow buffer. */
  intensity: number;
  /** `BloomEffect` mip-blur radius, 0..1 — how far the halo spreads. */
  radius: number;
  /** Multi-scale mip blur — Godot's glow is inherently multi-level. */
  mipmapBlur: true;
}

/** postprocessing's default mip-blur radius; `glow_strength = 1.0` maps here. */
const BASE_RADIUS = 0.85;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * `null` when this environment has no glow, so a caller can decide purely from
 * the settings whether to mount the post-process at all.
 */
export function bloomParamsFor(settings: EnvironmentSettings): BloomParams | null {
  const glow = settings.glow;
  if (!glow) return null;

  // `glow_bloom` lifts even sub-threshold pixels into the glow buffer. Fold it
  // into a lowered effective threshold (down to 0 at glow_bloom = 1) plus a
  // soft knee, which is the closest single-pass analogue.
  const threshold = Math.max(0, glow.hdrThreshold - glow.bloom);

  return {
    luminanceThreshold: threshold,
    luminanceSmoothing: 0.05 + 0.5 * clamp01(glow.bloom),
    intensity: glow.intensity,
    radius: clamp01(BASE_RADIUS * glow.strength),
    mipmapBlur: true,
  };
}
