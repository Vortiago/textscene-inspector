/**
 * What a directional light tells the scene's shadow fitter. A light declares its Godot shadow
 * parameters on its own `userData` and never sets its shadow camera: the fitter owns that, as
 * Godot's renderer owns directional shadow setup.
 */

import type * as THREE from 'three';

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
  /**
   * How many splits `directional_shadow_mode` draws: 1, 2 or 4. One split is the whole slice in
   * the light's own shadow map. More draw a shadow atlas with one fitted box per split.
   */
  splitCount: number;
  /** `directional_shadow_split_1` to `_3`: where the splits meet, as fractions of the slice. */
  splitOffsets: readonly number[];
  /** `directional_shadow_blend_splits`. */
  blendSplits: boolean;
}

/** The `userData` key. One key, so a light carries one declaration. */
const DECLARATION_KEY = 'directionalShadow';

/**
 * The `userData` that declares `declaration`, for a JSX `userData` prop. R3F assigns the object
 * whole, so a light gets no other `userData` through this path.
 */
export function directionalShadowUserData(
  declaration: DirectionalShadowDeclaration
): Record<string, unknown> {
  return { [DECLARATION_KEY]: declaration };
}

/** The light's declaration, or null for a light that made none, which the fitter leaves alone. */
export function readDirectionalShadowDeclaration(light: THREE.Object3D): DirectionalShadowDeclaration | null {
  const declaration = (light.userData as Record<string, unknown>)[DECLARATION_KEY];
  return isDeclaration(declaration) ? declaration : null;
}

function isDeclaration(value: unknown): value is DirectionalShadowDeclaration {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.maxDistance === 'number' &&
    typeof candidate.pancakeSize === 'number' &&
    typeof candidate.fadeStart === 'number' &&
    typeof candidate.depthBias === 'number' &&
    typeof candidate.normalBias === 'number' &&
    typeof candidate.splitCount === 'number' &&
    Array.isArray(candidate.splitOffsets) &&
    typeof candidate.blendSplits === 'boolean'
  );
}
