/** RemoteTransform2D type definitions. */

import type { Node2DProperties } from '../../base/node2d/types';

export interface RemoteTransform2DProperties extends Node2DProperties {
  /** NodePath of the remote Node2D this node pushes its transform to. */
  remote_path?: string;
  /** Whether the remote node's position is updated. Godot default is true. */
  update_position?: boolean;
  /** Whether the remote node's rotation is updated. Godot default is true. */
  update_rotation?: boolean;
  /** Whether the remote node's scale is updated. Godot default is true. */
  update_scale?: boolean;
  /** Whether the update uses global, not local, coordinates. Godot default is true. */
  use_global_coordinates?: boolean;
}
