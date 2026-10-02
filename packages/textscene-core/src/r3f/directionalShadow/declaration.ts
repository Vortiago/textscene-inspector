/**
 * What a directional light tells the scene's shadow fitter. A light declares its Godot shadow
 * parameters on its own `userData` and never sets its shadow camera: the fitter owns that, as
 * Godot's renderer owns directional shadow setup.
 */

import { userDataDeclaration } from '../userDataDeclaration.js';

export interface DirectionalShadowDeclaration {
  /** `directional_shadow_max_distance`. Zero or less leaves the camera's far plane in charge. */
  maxDistance: number;
  /** `directional_shadow_pancake_size`. A positive size lets casters nearer the light cast. */
  pancakeSize: number;
  /** `directional_shadow_fade_start`: the fraction of the slice where the shadow starts to fade. */
  fadeStart: number;
  /**
   * The depth bias in normalised depth, over Godot's own depth range for the map. The fitter
   * rescales it when three's range is longer, so its size in world units matches Godot.
   */
  depthBias: number;
  /** `shadow_normal_bias`, in shadow-map texels. The fitter turns it into world units. */
  normalBias: number;
  /** The PCF kernel's radius in atlas texels: Godot's `soft_shadow_scale`. */
  filterRadius: number;
  /**
   * How many splits `directional_shadow_mode` draws: 1, 2 or 4. Each split draws one fitted box
   * into its part of the light's share of the atlas. One split is the whole slice.
   */
  splitCount: number;
  /** `directional_shadow_split_1` to `_3`: where the splits meet, as fractions of the slice. */
  splitOffsets: readonly number[];
  /** `directional_shadow_blend_splits`. */
  blendSplits: boolean;
  /**
   * Whether the light takes a share of Godot's directional shadow atlas: `shadow_enabled` on and
   * `sky_mode` not Sky Only (`sharesDirectionalShadowAtlas`).
   */
  sharesAtlas: boolean;
}

const declaration = userDataDeclaration<DirectionalShadowDeclaration>(
  'directionalShadow',
  (candidate) =>
    typeof candidate.maxDistance === 'number' &&
    typeof candidate.pancakeSize === 'number' &&
    typeof candidate.fadeStart === 'number' &&
    typeof candidate.depthBias === 'number' &&
    typeof candidate.normalBias === 'number' &&
    typeof candidate.filterRadius === 'number' &&
    typeof candidate.splitCount === 'number' &&
    Array.isArray(candidate.splitOffsets) &&
    typeof candidate.blendSplits === 'boolean' &&
    typeof candidate.sharesAtlas === 'boolean'
);

/** The `userData` entry that declares a light's shadow, to merge into the light's `userData`. */
export const directionalShadowUserData = declaration.userData;

/** The light's declaration, or null for a light that made none, which the fitter leaves alone. */
export const readDirectionalShadowDeclaration = declaration.read;
