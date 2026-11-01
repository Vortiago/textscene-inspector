/** Joint3D property surface: the Node3D transform plus the two body paths. */

import type { Node3DProperties } from '../../../base/node3d/types';

export interface Joint3DProperties extends Node3DProperties {
  /** The path of the first body, as the file writes it. Unset or unreadable stays `undefined`. */
  node_a?: string;
  /** The path of the second body, as the file writes it. Unset or unreadable stays `undefined`. */
  node_b?: string;
}
