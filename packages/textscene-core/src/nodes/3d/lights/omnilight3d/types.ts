/**
 * OmniLight3D type definitions
 */

import type { Node3DProperties } from '../../../base/node3d/types';
import type { BaseLightWithNormalBias } from '../shared/types';

/**
 * OmniLight3D node properties
 *
 * Extends Node3D with omnidirectional point light capabilities
 */
export interface OmniLight3DProperties extends Node3DProperties, BaseLightWithNormalBias {
  /** Maximum distance the light reaches */
  omni_range: number;

  /** Light attenuation/decay (how light falls off with distance) */
  omni_attenuation: number;

  /** Omni shadow mode - DUAL_PARABOLOID or CUBE (optional) */
  omni_shadow_mode?: number;
}
