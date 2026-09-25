/** CanvasModulate: a Node2D that applies an ambient `color` tint to its whole canvas. */

import type { Color, Node2DProperties } from '../../base/node2d/types';

export interface CanvasModulateProperties extends Node2DProperties {
  /** Ambient RGBA tint (sRGB, default white). */
  color: Color;
}
