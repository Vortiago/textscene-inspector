/** The Bone2D property shape: a Node2D with the rest pose its Skeleton2D binds the skin at. */

import type { Transform2DColumns } from '../../../godot/math/transform2d.js';
import type { Node2DProperties } from '../../base/node2d/types';

export interface Bone2DProperties extends Node2DProperties {
  /** The pose the skin is bound at, relative to the parent bone or the skeleton. */
  rest: Transform2DColumns;
}
