/** OmniLight3D node data. */

import type { Node3DProperties } from '../../../base/node3d/types';
import type { BaseLightWithNormalBias } from '../shared/types';

/** OmniLight3D properties: Light3D plus range, attenuation and shadow mode. */
export interface OmniLight3DProperties extends Node3DProperties, BaseLightWithNormalBias {
  /** Maximum distance the light reaches */
  omni_range: number;

  /** How the light falls off with distance. */
  omni_attenuation: number;

  /** DUAL_PARABOLOID or CUBE (optional). */
  omni_shadow_mode?: number;
}
