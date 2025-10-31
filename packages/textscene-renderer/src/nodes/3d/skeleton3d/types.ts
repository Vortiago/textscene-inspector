/**
 * Skeleton3D-specific type definitions
 */

import type { Node3DProperties } from '../../base/node3d/types';

/**
 * Skeleton3D node properties
 *
 * Manages skeletal animation bones for 3D models.
 * Used for character animation, procedural animation, and ragdoll physics.
 */
export interface Skeleton3DProperties extends Node3DProperties {
  /** Animation motion scale multiplier (default: 1.0) */
  motion_scale?: number;

  /** Force bones into rest pose for debugging (default: false) */
  show_rest_only?: boolean;

  /** Enable physics simulation for physical bones (deprecated, default: true) */
  animate_physical_bones?: boolean;

  /**
   * When skeleton modifier processing occurs
   * 0 = MODIFIER_CALLBACK_MODE_PROCESS_PHYSICS
   * 1 = MODIFIER_CALLBACK_MODE_PROCESS_IDLE
   * 2 = MODIFIER_CALLBACK_MODE_PROCESS_MANUAL
   * (default: 1 = IDLE)
   */
  modifier_callback_mode_process?: number;

  /** Indexed bone properties (e.g., bones/0/position) */
  bones: Map<string, string>;
}
