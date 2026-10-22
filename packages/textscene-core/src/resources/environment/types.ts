/**
 * Environment resource types: the decoded property bag and the applied settings. They
 * live here, not beside their producers, so the slice's `index.ts` re-exports the
 * settings type without importing `build.ts`, which the render layer pulls in.
 */

import type { Rgba } from '../../godot/math/math';
import type { Vector3 } from '../../godot/math/vector';
import type { AmbientSource, BackgroundMode } from '../../godot/scene/environment.js';
import type { EnumValue } from '../../godot/classdb/enumNames.js';

export interface EnvironmentProperties {
  // Background
  background_mode: EnumValue<typeof BackgroundMode>;
  background_color: Rgba;
  background_energy_multiplier: number;

  /**
   * Sky SubResource reference, for example `SubResource("Sky_1")`. Present when
   * background_mode is BG_SKY. Parsed for inspection/validation; full sky/IBL
   * rendering is deferred (BG_SKY falls back to a flat background).
   */
  sky?: string;
  /** The sky's Euler rotation in radians, YXZ order as `Basis::from_euler` reads it. */
  sky_rotation: Vector3;

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
  ambient_light_source: EnumValue<typeof AmbientSource>;
  ambient_light_color: Rgba;
  ambient_light_energy: number;
  /**
   * How much of the ambient comes from the sky rather than
   * `ambient_light_color`, 0..1. Only read when the ambient source is a
   * cubemap; at the default 1.0 the flat colour contributes nothing.
   */
  ambient_light_sky_contribution: number;

  // Depth fog
  fog_enabled: boolean;
  /** 0 EXPONENTIAL (default), 1 DEPTH. */
  fog_mode: number;
  fog_light_color: Rgba;
  fog_light_energy: number;
  /** How much the directional lights tint the fog towards them. */
  fog_sun_scatter: number;
  /** The default follows `fog_mode`: 0.01 when exponential, 1 when depth. */
  fog_density: number;
  /** How far the sky shows through the fog colour, 0-1. */
  fog_aerial_perspective: number;
  /** How far the fog covers the background, 0-1. */
  fog_sky_affect: number;
  fog_height: number;
  /** Negative fogs above `fog_height`, positive below it. 0 turns the height fog off. */
  fog_height_density: number;
  /** DEPTH mode's exponent on the fog between its begin and end. */
  fog_depth_curve: number;
  /** DEPTH mode's range, after the setters keep `begin <= end`. */
  fog_depth_begin: number;
  /** 0 or below ends the fog at the camera's far plane. */
  fog_depth_end: number;

  // Volumetric Fog
  volumetric_fog_enabled: boolean;
  volumetric_fog_density: number;
  /** The scattering colour, sRGB: the share of the light the medium scatters into the view. */
  volumetric_fog_albedo: Rgba;
  volumetric_fog_emission: Rgba;
  volumetric_fog_emission_energy: number;
  /** The Henyey-Greenstein `g`: positive scatters forward, towards the light. */
  volumetric_fog_anisotropy: number;
  /** How far from the camera the froxel volume reaches, in metres. */
  volumetric_fog_length: number;
  /** The exponent that packs the volume's slices towards the camera, already clamped to 0.5-6. */
  volumetric_fog_detail_spread: number;
  /** How much of the ambient light and sky the medium scatters. 0 injects none. */
  volumetric_fog_ambient_inject: number;
  /** How far the fog covers the background, 0-1. */
  volumetric_fog_sky_affect: number;
  /** Whether each frame blends into the last, reprojected, over Godot's 16 temporal jitters. */
  volumetric_fog_temporal_reprojection_enabled: boolean;
  /** The share of the last frame each frame keeps, 0.5-0.99. */
  volumetric_fog_temporal_reprojection_amount: number;

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
  /** The texture that scales the glow per screen position, as its raw reference. */
  glow_map?: string;

  adjustment_enabled: boolean;
  adjustment_brightness: number;
  adjustment_contrast: number;
  adjustment_saturation: number;
}

/** The three scalars Godot's tonemap pass applies under `FLAG_USE_BCS`. */
export interface EnvironmentAdjustments {
  /** Linear: Godot converts the authored sRGB brightness on store. */
  brightness: number;
  contrast: number;
  saturation: number;
}

/** Depth fog (Godot `fog_enabled`), apart from the volumetric fog. */
export interface DepthFog {
  /** 0 EXPONENTIAL, 1 DEPTH. */
  mode: number;
  /** sRGB, not yet times `lightEnergy`. */
  color: Rgba;
  lightEnergy: number;
  sunScatter: number;
  density: number;
  aerialPerspective: number;
  skyAffect: number;
  height: number;
  heightDensity: number;
  depthCurve: number;
  depthBegin: number;
  /** 0 or below ends the fog at the camera's far plane. */
  depthEnd: number;
}

/**
 * Volumetric fog: a medium in a froxel volume in front of the camera, lit by
 * the lights and the ambient, which every surface and the background sample. Colours stay in
 * Godot space: the consumer converts sRGB to linear.
 */
export interface VolumetricFog {
  density: number;
  albedo: Rgba;
  emission: Rgba;
  emissionEnergy: number;
  /** The Henyey-Greenstein `g` of every light the medium scatters. */
  anisotropy: number;
  length: number;
  detailSpread: number;
  /**
   * The ambient the medium scatters, read whatever the ambient source (`fog.cpp:1067-1076`).
   * `inject` already carries `ambient_light_energy`.
   */
  ambient: {
    inject: number;
    color: Rgba;
    /** The sky's share of the injected ambient, against `color`. */
    skyContribution: number;
  };
  skyAffect: number;
  /**
   * The share of the last frame each frame keeps while the cells jitter, or null to sample each
   * cell at its centre with no history.
   */
  temporalReprojection: number | null;
}

/** `createEnvironmentSettings`'s output: one Environment as the render layer applies it. */
export interface EnvironmentSettings {
  background: {
    mode: number;
    /** The sRGB colour BG_CLEAR_COLOR or BG_COLOR draws, scaled by the energy multiplier. */
    color: Rgba;
    /** The sky's intensity under BG_SKY. `color` already carries it. */
    energyMultiplier: number;
  };
  /**
   * Flat ambient. Null when the source emits none (DISABLED) or when the ambient is
   * a cubemap rather than a constant (a sky background).
   */
  ambient: {
    color: Rgba;
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
     * `AmbientSource.COLOR`. It scales the ambient only, never the reflection.
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
  /** Null when disabled. */
  fog: DepthFog | null;
  /** The sky's Euler rotation in radians, YXZ order: the background, its light and the fog read it. */
  skyRotation: Vector3;
  /** Null when disabled. */
  volumetricFog: VolumetricFog | null;
  /** The colour adjustments the tone-map pass applies after the curve, null when disabled. */
  adjustments: EnvironmentAdjustments | null;
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
    /** The screen-space texture that scales the glow (`glow_map`), as its raw reference. */
    map: string | undefined;
    /** How far the map scales the glow, 0..1 (`glow_map_strength`). */
    mapStrength: number;
  } | null;
}
