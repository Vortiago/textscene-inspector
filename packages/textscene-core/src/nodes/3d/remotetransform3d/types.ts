/** RemoteTransform3D type definitions. */

import type { Node3DProperties } from '../../base/node3d/types';

export interface RemoteTransform3DProperties extends Node3DProperties {
  /** NodePath of the remote Node3D this node pushes its transform to. */
  remote_path?: string;
  /** Whether the remote node's position is updated. Godot default is true. */
  update_position?: boolean;
  /** Whether the remote node's rotation is updated. Godot default is true. */
  update_rotation?: boolean;
  /** Whether the remote node's scale is updated. Godot default is true. */
  update_scale?: boolean;
  /** Whether the update uses global (vs local) coordinates. Godot default is true. */
  use_global_coordinates?: boolean;
}
