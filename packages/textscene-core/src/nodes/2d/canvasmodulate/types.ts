/** CanvasModulate: a Node2D that applies an ambient `color` tint to its whole canvas. */

import type { Node2DProperties } from '../../base/node2d/types';
import type { Rgba } from '../../../godot/math';

export interface CanvasModulateProperties extends Node2DProperties {
  /** Ambient RGBA tint (sRGB, default white). */
  color: Rgba;
}
