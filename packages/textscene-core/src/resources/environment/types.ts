/**
 * Environment resource types: the decoded property bag and the applied settings. They
 * live here, not beside their producers, so the slice's `index.ts` re-exports the
 * settings type without importing `build.ts`, which the render layer pulls in.
 */

import type { Color } from '../../utils/colorParser';

/**
 * Godot's `Environment.tonemap_agx_contrast` default (`environment.h`; `ADD_PROPERTY`
 * at `environment.cpp:1290`, hint `"1.0,2.0,0.01,or_greater"`). It lives with the data
 * because the decode needs it too, and routing must not import five tone-curve bodies.
 */
export const DEFAULT_AGX_CONTRAST = 1.25;

export enum BackgroundMode {
  BG_CLEAR_COLOR = 0,
  BG_COLOR = 1,
  BG_SKY = 2,
  BG_CANVAS = 3,
  BG_KEEP = 4,
  BG_CAMERA_FEED = 5,
}

export interface EnvironmentProperties {
  // Background
  background_mode: BackgroundMode;
  background_color: Color;
  background_energy_multiplier: number;

  /**
   * Sky SubResource reference, for example `SubResource("Sky_1")`. Present when
   * background_mode is BG_SKY. Parsed for inspection/validation; full sky/IBL
   * rendering is deferred (BG_SKY falls back to a flat background).
   */
  sky?: string;

  // Tonemapping
  /** 0 LINEAR, 1 REINHARDT, 2 FILMIC, 3 ACES, 4 AGX. */
  tonemap_mode: number;
  /** The white reference for every curve except AgX. Default 1.0. */
  tonemap_white: number;
  /**
   * AgX's own white reference, which Godot uses instead of `tonemap_white` when the
   * mode is AGX (`Environment::_update_tonemap`). Its default is Blender's AgX white,
   * 16.29, so reading `tonemap_white`'s 1.0 instead reshapes the whole shoulder.
   */
  tonemap_agx_white: number;
  /**
   * AgX's curve contrast, default 1.25: dark values darker, bright values brighter.
   * Only in effect under AGX, and folded into the curve parameters Godot computes on
   * the CPU rather than applied as a separate stage.
   */
  tonemap_agx_contrast: number;
  tonemap_exposure: number;

  // Ambient lighting (scene-wide constant illumination)
  /** 0 BG (default), 1 DISABLED, 2 COLOR, 3 SKY. Only 2 and 3 emit a flat ambient. */
  ambient_light_source: number;
  ambient_light_color: Color;
  ambient_light_energy: number;
  /**
   * How much of the ambient comes from the sky rather than
   * `ambient_light_color`, 0..1. Only read when the ambient source is a
   * cubemap; at the default 1.0 the flat colour contributes nothing.
   */
  ambient_light_sky_contribution: number;

  // Screen-space fog (maps to THREE.Fog/FogExp2)
  fog_enabled: boolean;
  fog_density: number;
  fog_light_color: Color;
  /** 0 EXPONENTIAL (default), 1 DEPTH. */
  fog_mode: number;

  // Volumetric Fog
  volumetric_fog_enabled: boolean;
  volumetric_fog_density: number;
  volumetric_fog_albedo: Color;
  volumetric_fog_emission: Color;

  // Glow, a compositor post-process: a peak-channel bright pass over a weighted mip
  // pyramid, blended back around the tone curve. The editor preview environment
  // enables it, which is why emissive materials bloom in Godot's editor.
  glow_enabled: boolean;
  /**
   * The seven mip weights, finest (index 0, `glow_levels/1`) to coarsest.
   * Godot sums `mip[i] * weight[i]`, unnormalised, skipping weights <= 0.0001. The
   * defaults `[0, 0.8, 0.4, 0.1, 0, 0, 0]` keep a Godot halo tight: the finest mip
   * is off and nothing past the fourth contributes.
   */
  glow_levels: number[];
  /** Divides every level weight by their sum. Default false. */
  glow_normalized: boolean;
  /** Multiplies the gathered glow just before the blend. Default 0.3. */
  glow_intensity: number;
  /** Multiplies the glow buffer at every pyramid pass, so it compounds. Default 1.0. */
  glow_strength: number;
  /** The `color * (1 - mix) + glow` lerp factor, MIX blend only. Default 0.05. */
  glow_mix: number;
  /** Floor on the bright-pass feedback: at 1.0 every pixel glows. Default 0.0. */
  glow_bloom: number;
  /** 0 ADDITIVE, 1 SCREEN (default), 2 SOFTLIGHT, 3 REPLACE, 4 MIX. */
  glow_blend_mode: number;
  /** Peak HDR channel where the bright-pass knee starts. Default 1.0. */
  glow_hdr_threshold: number;
  /** Width of the bright-pass smoothstep knee above the threshold. Default 2.0. */
  glow_hdr_scale: number;
  /** Per-channel ceiling on the bright-pass result. Default 12.0. */
  glow_hdr_luminance_cap: number;
  /** How far the glow map modulates the glow buffer, 0..1. Default 0.8. */
  glow_map_strength: number;

  // Adjustments (parsed but warned in v1)
  adjustment_enabled: boolean;
  adjustment_brightness: number;
  adjustment_contrast: number;
  adjustment_saturation: number;

  // SSR (parsed but warned in v1)
  ssr_enabled: boolean;
}

/** `createEnvironmentSettings`'s output: one Environment as the render layer applies it. */
export interface EnvironmentSettings {
  background: {
    mode: number;
    color: Color;
    energyMultiplier: number;
  };
  /**
   * Flat ambient. Null when the source emits none (DISABLED) or when the ambient is
   * a cubemap rather than a constant (a sky background).
   */
  ambient: {
    color: Color;
    energy: number;
  } | null;
  /**
   * The sky as an image-based light (IBL), which both lights surfaces and is what they
   * reflect. Present whenever a sky IBL exists to reflect (`reflection_source` defaults
   * to the background), whatever the diffuse ambient source: a metal reflects the sky
   * even when the flat ambient is a constant colour.
   */
  skyAmbient: {
    /** `background_energy_multiplier`, the sky's reflection strength. */
    energy: number;
    /**
     * `ambient_light_sky_contribution`: the sky's share of the diffuse ambient, 0 for
     * `AMBIENT_SOURCE_COLOR`. Godot scales it apart from `energy`, and three.js couples
     * the two, so the render layer splits them with `envMapIntensity` keyed on metalness.
     */
    contribution: number;
  } | null;
  /**
   * Godot's tonemapper. Always present: LINEAR, the default, is a real choice meaning
   * "no tone mapping", not an absence. The editor preview environment picks FILMIC.
   */
  toneMapping: {
    mode: number;
    exposure: number;
    /**
     * Godot's `env->white`, the input the curve maps to 1.0, already resolved
     * to whichever of `tonemap_white` / `tonemap_agx_white` the mode reads
     * (`Environment::_update_tonemap`). The per-curve floors Godot applies on
     * top of it are `resolvedWhite`'s, at the point the curve is built.
     */
    white: number;
    /** `tonemap_agx_contrast`, carried whatever the mode. Only AgX reads it. */
    agxContrast: number;
  };
  /** Screen-space fog (Godot fog_enabled). Volumetric fog has no THREE equivalent. */
  fog: {
    density: number;
    color: Color;
    mode: number;
  } | null;
  adjustments: {
    enabled: boolean;
    brightness: number;
    contrast: number;
    saturation: number;
  } | null;
  ssr: {
    enabled: boolean;
  } | null;
  /**
   * Glow post-process, null when disabled. The render layer that consumes it owns
   * tonemapping too: every blend mode but SOFTLIGHT composites into linear HDR before
   * the tone curve, and SOFTLIGHT composites after it (see `godotGlow.ts`).
   */
  glow: {
    /** The seven mip weights, finest first, already normalised if asked for. */
    levels: number[];
    /** Multiplies the gathered glow before the blend (`glow_intensity`). */
    intensity: number;
    /** Per-pass multiplier on the glow buffer (`glow_strength`). */
    strength: number;
    /** MIX-blend lerp factor (`glow_mix`). */
    mix: number;
    /** Bright-pass feedback floor, 0..1 (`glow_bloom`). */
    bloom: number;
    /** 0 ADDITIVE, 1 SCREEN, 2 SOFTLIGHT, 3 REPLACE, 4 MIX. */
    blendMode: number;
    /** Peak HDR channel where the bright-pass knee starts (`glow_hdr_threshold`). */
    hdrThreshold: number;
    /** Knee width above the threshold (`glow_hdr_scale`). */
    hdrScale: number;
    /** Per-channel ceiling on the bright-pass (`glow_hdr_luminance_cap`). */
    luminanceCap: number;
  } | null;
}
