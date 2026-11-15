/** CanvasGroup: a Node2D that composites the children at its `z_final` through one buffer. */

import type { Node2DProperties } from '../../base/node2d/types';

export interface CanvasGroupProperties extends Node2DProperties {
  /** How far the composite rect grows past the children's rects, in canvas pixels. */
  fit_margin: number;
  /** How far the cleared buffer area grows past the composite rect. It changes no pixel here. */
  clear_margin: number;
  /** Whether Godot builds the buffer's mipmaps, which only a group shader reads. */
  use_mipmaps: boolean;
}
