/**
 * Godot 4.6.3's volumetric fog in the Forward+ renderer: the froxel grid, its slices, the temporal
 * jitter it converges over and the filter it blurs with. Paths under `renderer_rd/` are in
 * `servers/rendering/renderer_rd/`, and a bare `.glsl:N` is its
 * `shaders/environment/volumetric_fog_process.glsl`.
 */

import { clamp } from './math.js';

/** `Environment::set_volumetric_fog_detail_spread` clamps into this range (`environment.cpp:982`). */
const DETAIL_SPREAD_MIN = 0.5;
const DETAIL_SPREAD_MAX = 6.0;

/** The detail spread the Environment stores for an authored one. */
export function volumetricFogDetailSpread(authored: number): number {
  return clamp(authored, DETAIL_SPREAD_MIN, DETAIL_SPREAD_MAX);
}

/** The project settings that shape the volumetric fog pass, for every Environment in the project. */
export interface VolumetricFogProjectSettings {
  /** `rendering/environment/volumetric_fog/volume_size`: the grid's side before the aspect stretch. */
  volumeSize: number;
  /** `rendering/environment/volumetric_fog/volume_depth`: the grid's slice count. */
  volumeDepth: number;
  /** `rendering/environment/volumetric_fog/use_filter`: blur each slice before the integration. */
  useFilter: boolean;
  /** `rendering/environment/fog/use_legacy_blending`: Godot 4.0's composite, before 4.3's fix. */
  useLegacyBlending: boolean;
}

/** Each setting's `GLOBAL_DEF` (`servers/rendering/rendering_server.cpp:3828-3831`). */
export const VOLUMETRIC_FOG_DEFAULTS: VolumetricFogProjectSettings = {
  volumeSize: 64,
  volumeDepth: 64,
  useFilter: true,
  useLegacyBlending: false,
};

export interface VolumetricFogGrid {
  width: number;
  height: number;
  depth: number;
}

/**
 * The froxel grid for a frame: the side stretched by the frame's aspect against the integer mean of
 * its sides, then truncated (`forward_clustered/render_forward_clustered.cpp:1316-1319`).
 */
export function volumetricFogGrid(
  frame: { width: number; height: number },
  settings: VolumetricFogProjectSettings
): VolumetricFogGrid {
  const ratio = frame.width / Math.trunc((frame.width + frame.height) / 2);
  return {
    width: Math.trunc(settings.volumeSize * ratio),
    height: Math.trunc(settings.volumeSize / ratio),
    depth: settings.volumeDepth,
  };
}

/**
 * The view depth of each slice centre: the unit depth of the centre raised to the detail spread,
 * times the fog length (`.glsl:215-219`). A spread above 1 packs the slices towards the camera.
 */
export function volumetricFogSliceDepths({
  depth,
  length,
  detailSpread,
}: {
  depth: number;
  length: number;
  detailSpread: number;
}): Float32Array {
  return Float32Array.from({ length: depth }, (_, slice) => length * ((slice + 0.5) / depth) ** detailSpread);
}

/** How a surface finds its depth in the volume: the inverses of the slice mapping's two terms. */
export interface VolumetricFogLookup {
  inverseLength: number;
  inverseSpread: number;
}

/**
 * The scene's lookup terms (`forward_clustered/render_forward_clustered.cpp:731-743`). A surface at
 * view depth `z` samples the slice coordinate `(z * inverseLength) ^ inverseSpread`. A fog length of
 * 0 takes an inverse of 1, not a division by zero.
 */
export function volumetricFogLookup({
  length,
  detailSpread,
}: {
  length: number;
  detailSpread: number;
}): VolumetricFogLookup {
  return { inverseLength: length > 0 ? 1 / length : 1, inverseSpread: 1 / detailSpread };
}

export interface HalfExtents {
  x: number;
  y: number;
}

/** A projection as the fog volume reads it: its planes and their half extents in view space. */
export interface FogProjection {
  near: number;
  far: number;
  nearHalfExtents: HalfExtents;
  farHalfExtents: HalfExtents;
  isOrthographic: boolean;
}

/**
 * The view-space half extents of the volume's first and last slices. The volume ends at the
 * frustum's section at the fog length and opens at its near plane, or keeps the end's section
 * under an orthographic projection (`environment/fog.cpp:1047-1059`).
 */
export function volumetricFogFrustum(
  projection: FogProjection,
  length: number
): { begin: HalfExtents; end: HalfExtents } {
  const { near, far, nearHalfExtents, farHalfExtents } = projection;
  const reach = (length - near) / (far - near);
  const end = {
    x: nearHalfExtents.x + (farHalfExtents.x - nearHalfExtents.x) * reach,
    y: nearHalfExtents.y + (farHalfExtents.y - nearHalfExtents.y) * reach,
  };
  if (projection.isOrthographic) return { begin: end, end };
  return { begin: { x: Math.max(nearHalfExtents.x, 0.001), y: Math.max(nearHalfExtents.y, 0.001) }, end };
}

/**
 * The 16 jitters a cell takes in turn while the camera holds still, as fractions of the cell
 * (`.glsl:257-275`). Temporal reprojection blends each frame into the last, so a still frame
 * converges to their mean.
 */
export const VOLUMETRIC_FOG_TEMPORAL_JITTERS: readonly (readonly [number, number, number])[] = [
  [0.5, 0.33333333, 0.2],
  [0.25, 0.66666667, 0.4],
  [0.75, 0.11111111, 0.6],
  [0.125, 0.44444444, 0.8],
  [0.625, 0.77777778, 0.04],
  [0.375, 0.22222222, 0.24],
  [0.875, 0.55555556, 0.44],
  [0.0625, 0.88888889, 0.64],
  [0.5625, 0.03703704, 0.84],
  [0.3125, 0.37037037, 0.08],
  [0.8125, 0.7037037, 0.28],
  [0.1875, 0.14814815, 0.48],
  [0.6875, 0.48148148, 0.68],
  [0.4375, 0.81481481, 0.88],
  [0.9375, 0.25925926, 0.12],
  [0.03125, 0.59259259, 0.32],
];

/** Where a cell samples without temporal reprojection: its centre (`.glsl:297`). */
export const VOLUMETRIC_FOG_CELL_CENTRE: readonly [number, number, number] = [0.5, 0.5, 0.5];

/** The 7-tap gaussian the filter runs along X, then along Y (`.glsl:735`). */
export const VOLUMETRIC_FOG_FILTER_WEIGHTS: readonly number[] = [
  0.071303, 0.131514, 0.189879, 0.214607, 0.189879, 0.131514, 0.071303,
];

/** A cell at or below this density scatters no light, only its emission (`.glsl:383`). */
export const VOLUMETRIC_FOG_LIT_DENSITY_MIN = 0.00005;

/**
 * How sharply the fog darkens past a shadow's caster, per world unit: `INV_FOG_FADE` (`.glsl:278`).
 * A cell a tenth of a unit past the caster keeps 1/e of its light.
 */
export const VOLUMETRIC_FOG_SHADOW_FADE = 10;

/** A light whose shadow opacity is at or below this lights the fog unshadowed (`.glsl:389`, `:493`, `:557`). */
export const VOLUMETRIC_FOG_SHADOW_OPACITY_MIN = 0.001;

/** A light whose `light_volumetric_fog_energy` is at or below this leaves the fog dark (`.glsl:385`). */
export const VOLUMETRIC_FOG_LIGHT_ENERGY_MIN = 0.001;

/** `light_volumetric_fog_energy`'s default (`scene/3d/light_3d.cpp:475`). */
export const LIGHT_VOLUMETRIC_FOG_ENERGY_DEFAULT = 1;

/** `spot_angle_attenuation`'s default (`scene/3d/light_3d.cpp:481`). */
export const SPOT_ANGLE_ATTENUATION_DEFAULT = 1;

/** `rendering/reflections/sky_reflections/roughness_layers` (`rendering_server.cpp:3727`). */
const SKY_ROUGHNESS_LAYERS_DEFAULT = 8;

/**
 * The radiance mip the ambient inject reads the sky at, as a fraction of the coarsest
 * (`MAX_SKY_LOD`, the default 8 `roughness_layers` less one, `environment/fog.cpp:304`). A denser
 * medium reads a blurrier sky (`.glsl:434`).
 */
export function volumetricFogSkyRoughness(density: number): number {
  const maxSkyLod = SKY_ROUGHNESS_LAYERS_DEFAULT - 1;
  return Math.min((2 + density * (maxSkyLod - 2)) / maxSkyLod, 1);
}
