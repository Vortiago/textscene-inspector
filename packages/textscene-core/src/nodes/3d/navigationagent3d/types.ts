/** NavigationAgent3D type definitions. */

import type { NodeProperties } from '../../node/types';
import type { Vector3 } from '../../../parser/vectors';

export interface NavigationAgent3DProperties extends NodeProperties {
  /** Agent radius used for avoidance. Godot default is 0.5. */
  radius?: number;
  /** Agent height used for avoidance. Godot default is 1.0. */
  height?: number;
  /** Whether avoidance is enabled for this agent. Godot default is false. */
  avoidance_enabled?: boolean;
  /** 32-bit bitmask of the layers other avoidance agents and obstacles see this agent on. */
  avoidance_layers?: number;
  /** 32-bit bitmask of the avoidance layers this agent reacts to. */
  avoidance_mask?: number;
  /** Max avoidance neighbors considered. Godot default is 10. */
  max_neighbors?: number;
  /** Max agent speed for avoidance calculations. Godot default is 10.0. */
  max_speed?: number;
  /** 32-bit navigation-mesh layer bitmask used for path queries. */
  navigation_layers?: number;
  /** Distance from the target at which the agent is considered arrived. */
  target_desired_distance?: number;
  /** Distance from each path point at which it counts as reached. */
  path_desired_distance?: number;
  /** The agent's movement target. */
  target_position?: Vector3;
}
