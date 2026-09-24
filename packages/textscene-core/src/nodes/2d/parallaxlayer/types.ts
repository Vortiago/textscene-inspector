/** The ParallaxLayer property shape: a Node2D whose pose a parent ParallaxBackground overwrites. */

import type { Node2DProperties, Vector2 } from '../../base/node2d/types';

export interface ParallaxLayerProperties extends Node2DProperties {
  /** Multiplies the background's scroll; an axis at 0 pins that axis to the screen. */
  motion_scale: Vector2;
  /** Added to the scrolled position, scaled by the camera zoom. */
  motion_offset: Vector2;
  /** Repeat interval in pixels; an axis at 0 draws that axis once. */
  motion_mirroring: Vector2;
}
