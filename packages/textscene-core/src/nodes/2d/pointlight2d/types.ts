/** PointLight2D — a 2D point light with color, energy, blend mode, and optional texture. */

import type { Node2DProperties, Color, Vector2 } from '../../base/node2d/types';

export type PointLight2DBlendMode = 0 | 1 | 2; // ADD, SUB, MIX

export interface PointLight2DProperties extends Node2DProperties {
  enabled: boolean;
  color: Color;
  energy: number;
  blend_mode: PointLight2DBlendMode;
  texture?: string;
  texture_scale: number;
  offset: Vector2;
}
