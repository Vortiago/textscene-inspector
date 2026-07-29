/** PointLight2D — a 2D point light with color, energy, blend mode, and optional texture. */

import type { Node2DProperties, Color, Vector2 } from '../../base/node2d/types';

export type PointLight2DBlendMode = 0 | 1 | 2; // ADD, SUB, MIX

/** `Light2D.ShadowFilter`: NONE, PCF5, PCF13. */
export type PointLight2DShadowFilter = 0 | 1 | 2;

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
  /**
   * `Light2D.range_z_min` / `range_z_max`, default -1024 / 1024: the window of
   * ACCUMULATED `z_index` (Godot's `z_final`, clamped to +/-4096) this light
   * reaches. Tested per ITEM, inclusive at both ends. The default is wide enough
   * to go unnoticed on a scene whose z stays small, but it is a real bound:
   * `z_index`'s own -4096..4096 is an inspector hint, not a setter guard, so an
   * item can sit outside the window.
   */
  range_z_min: number;
  range_z_max: number;
  /**
   * `Light2D.range_layer_min` / `range_layer_max`, default 0 / 0: the window of
   * CANVAS layers this light is handed to. Tested per CANVAS rather than per
   * item — the world canvas is layer 0 and a `CanvasLayer` is its own canvas at
   * its `layer` (default 1), so a light that leaves these alone reaches the
   * world and no HUD.
   */
  range_layer_min: number;
  range_layer_max: number;
  /** `Light2D.shadow_enabled`: whether occluders in range carve this light. */
  shadow_enabled: boolean;
  /**
   * `Light2D.shadow_color`, default `Color(0, 0, 0, 0)` — a fully transparent
   * black, which is why a shadowed pixel reads back the unlit surface exactly
   * rather than being darkened.
   */
  shadow_color: Color;
  /**
   * `Light2D.shadow_filter`: how the shadow boundary is sampled. NONE is a hard
   * `step()`; PCF5/PCF13 spread it over `shadow_filter_smooth` pixels.
   */
  shadow_filter: PointLight2DShadowFilter;
  /** `Light2D.shadow_filter_smooth`: the PCF kernel's width, in shadow-map texels. */
  shadow_filter_smooth: number;
}

/**
 * The cull window an untouched `Light2D` carries. `scene/2d/light_2d.h:50-55`:
 *
 *   int item_mask = 1;
 *   int z_min = -1024;
 *   int z_max = 1024;
 *   int layer_min = 0;
 *   int layer_max = 0;
 *
 * Confirmed on the engine too: a fresh `PointLight2D` in Godot 4.6.3 reports
 * exactly those five values.
 *
 * One record because three readers ask about the same engine constants — the
 * parser's fallbacks, the linter's inverted-window test, and the renderer's
 * default cull key. Transcribed separately, a change to one leaves the linter
 * silent on exactly the scenes the renderer culls to black, and a MISSING
 * warning is the failure no test asserts.
 */
export const POINT_LIGHT_2D_RANGE_DEFAULTS = {
  itemCullMask: 1,
  zMin: -1024,
  zMax: 1024,
  layerMin: 0,
  layerMax: 0,
} as const;
