/** CanvasModulate — a Node2D that applies an ambient `color` tint to its subtree. */

import type { Node2DProperties } from '../../base/node2d/types';

export interface CanvasModulateProperties extends Node2DProperties {
  /** Ambient RGBA tint (sRGB, default white). */
  color: { r: number; g: number; b: number; a: number };
}
