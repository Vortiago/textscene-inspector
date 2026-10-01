/** DirectionalLight3D node data. */

import type { Node3DProperties } from '../../../base/node3d/types';
import type { BaseLightWithNormalBias } from '../shared/types';

/** DirectionalLight3D properties: Light3D plus the directional shadow and the sky mode. */
export interface DirectionalLight3DProperties extends Node3DProperties, BaseLightWithNormalBias {
  /** 0 draws one shadow map, 1 two splits and 2 four splits (optional). */
  directional_shadow_mode?: number;

  /** Where the first split ends, as a fraction of the shadowed range (optional). */
  directional_shadow_split_1?: number;

  /** Where the second split ends, with four splits (optional). */
  directional_shadow_split_2?: number;

  /** Where the third split ends, with four splits (optional). */
  directional_shadow_split_3?: number;

  /** Whether each split blends into the next (optional). */
  directional_shadow_blend_splits?: boolean;

  /** Maximum shadow distance (optional) */
  directional_shadow_max_distance?: number;

  /** How far the shadow's near plane sits towards the light past the view (optional). */
  directional_shadow_pancake_size?: number;

  /** The fraction of the max distance where the shadow starts to fade out (optional). */
  directional_shadow_fade_start?: number;

  /** 0 lights the scene and the sky, 1 only the scene and 2 only the sky (optional). */
  sky_mode?: number;
}
