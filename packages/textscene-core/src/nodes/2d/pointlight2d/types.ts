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
  /**
   * `Light2D.range_item_cull_mask`: the mask ANDed against each CanvasItem's
   * `light_mask` to decide whether this light reaches it. NOT the light's own
   * `light_mask`, which is the light node's CanvasItem mask and says nothing
   * about what it lights.
   */
  range_item_cull_mask: number;
  /**
   * `Light2D.shadow_item_cull_mask`: the same test for occluders, deciding
   * which `LightOccluder2D`s cast a shadow from this light.
   */
  shadow_item_cull_mask: number;
}
