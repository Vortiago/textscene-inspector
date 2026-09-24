/** DirectionalLight3D node data. */

import type { Node3DProperties } from '../../../base/node3d/types';
import type { BaseLightWithNormalBias } from '../shared/types';

/** DirectionalLight3D properties: Light3D plus the directional shadow. */
export interface DirectionalLight3DProperties extends Node3DProperties, BaseLightWithNormalBias {
  /** Cascade configuration (optional). */
  directional_shadow_mode?: number;

  /** Maximum shadow distance (optional) */
  directional_shadow_max_distance?: number;
}
