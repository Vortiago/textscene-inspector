/** Skeleton3D property types. */

import type { Node3DProperties } from '../../base/node3d/types';

/** Skeleton3D node properties: the bones behind skeletal, procedural and ragdoll animation. */
export interface Skeleton3DProperties extends Node3DProperties {
  /** Animation motion scale multiplier (default: 1.0) */
  motion_scale?: number;

  /** Force bones into rest pose for debugging (default: false) */
  show_rest_only?: boolean;

  /** Enable physics simulation for physical bones (deprecated, default: true) */
  animate_physical_bones?: boolean;

  /**
   * When skeleton modifiers process: 0 = MODIFIER_CALLBACK_MODE_PROCESS_PHYSICS, 1 =
   * MODIFIER_CALLBACK_MODE_PROCESS_IDLE (default), 2 = MODIFIER_CALLBACK_MODE_PROCESS_MANUAL.
   */
  modifier_callback_mode_process?: number;

  /** Indexed bone properties, such as bones/0/position. */
  bones: Map<string, string>;
}
