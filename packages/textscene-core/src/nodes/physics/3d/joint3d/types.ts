/** Joint3D property surface: the Node3D transform plus the two body paths. */

import type { Node3DProperties } from '../../../base/node3d/types';

export interface Joint3DProperties extends Node3DProperties {
  /** The path of the first body, as the file writes it. Unset or unreadable stays `undefined`. */
  node_a?: string;
  /** The path of the second body, as the file writes it. Unset or unreadable stays `undefined`. */
  node_b?: string;
}

/** Lower above upper, which `draw_circle` turns into the full circle: what a joint passes where its angular limit is off. */
export const FULL_CIRCLE_LIMITS = { lower: 0, upper: -1 };
