/**
 * Which items a 2D light reaches, and the class key that forces on the accumulator. The per-item
 * test is `_record_item_commands` in `drivers/gles3/rasterizer_canvas_gles3.cpp` (line 1347 on
 * master): the light mask, the `z_final` window and the rects. A directional light skips it.
 */
/*
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import { LIGHT_2D_RANGE_DEFAULTS } from '../../nodes/2d/lights/shared/types.js';
import { CANVAS_ITEM_Z_MAX, CANVAS_ITEM_Z_MIN } from '../../godot/rendering.js';

/**
 * Everything a light contributes to the cull test, and so the identity of an accumulation class. A
 * buffer sums its lights and nothing downstream subtracts one back out, so two lights share a
 * buffer only when no item can tell them apart: when all five values agree.
 */
export interface LightCullKey {
  /**
   * `Light2D.range_item_cull_mask`, ANDed against each CanvasItem's own `light_mask`. Not the
   * light node's `light_mask`, which is its CanvasItem mask and says nothing about what it lights.
   * Null for a directional light, which reaches every item whatever its `light_mask`.
   */
  readonly itemCullMask: number | null;
  /** `Light2D.range_z_min`: the lowest accumulated `z_index` this light reaches. */
  readonly zMin: number;
  /** `Light2D.range_z_max`: the highest, inclusive. */
  readonly zMax: number;
  /**
   * `Light2D.range_layer_min`: the lowest canvas layer this light is handed to. `_draw_viewport` in
   * `servers/rendering/renderer_viewport.cpp` (line 1220) tests it once per canvas: 0 for the world
   * canvas, the CanvasLayer's `layer` (default 1) inside one, so a light reaches any canvas in range.
   */
  readonly layerMin: number;
  /** `Light2D.range_layer_max`: the highest, inclusive. */
  readonly layerMax: number;
}

/**
 * An untouched `Light2D`'s window, from `LIGHT_2D_RANGE_DEFAULTS`. The z pair is wide but
 * still a window. The layer pair is narrow, which is why a default light never lights a default
 * CanvasLayer.
 */
export const DEFAULT_LIGHT_CULL_KEY: LightCullKey = LIGHT_2D_RANGE_DEFAULTS;

/**
 * The key of a DirectionalLight2D: every item, at any z, on a canvas in its layer window. The
 * renderer_rd `canvas.glsl:727-760` loop runs each directional light over every lit item, and
 * `renderer_viewport.cpp:678-684` filters the list per canvas by layer alone. An item's `z_final`
 * is clamped to the canvas z range, so that range is every z.
 */
export function directionalLightCullKey(layerMin: number, layerMax: number): LightCullKey {
  return { itemCullMask: null, zMin: CANVAS_ITEM_Z_MIN, zMax: CANVAS_ITEM_Z_MAX, layerMin, layerMax };
}

/**
 * `itemZ` is Godot's accumulated, clamped `z_final` (`canvasItemPlacement`), and `itemLayer` is the
 * layer of the item's canvas. Bounds are inclusive and `min > max` is empty: the four setters
 * neither clamp nor reorder (probed on Godot 4.6.3). JS `&` covers the 32 bits Godot compares, and
 * `!== 0` reads it as C++'s `if` does.
 */
export function lightReachesItem(
  key: LightCullKey,
  itemLightMask: number,
  itemZ: number,
  itemLayer: number
): boolean {
  return (
    (key.itemCullMask === null || (key.itemCullMask & itemLightMask) !== 0) &&
    itemZ >= key.zMin &&
    itemZ <= key.zMax &&
    itemLayer >= key.layerMin &&
    itemLayer <= key.layerMax
  );
}

/**
 * A canonical string for the tuple, for use as a Map key. Separated rather than
 * concatenated, so `(1, 11, …)` and `(11, 1, …)` cannot collide.
 */
export function lightCullKeyId(key: LightCullKey): string {
  return `${key.itemCullMask}|${key.zMin}|${key.zMax}|${key.layerMin}|${key.layerMax}`;
}

export function sameLightCullKey(a: LightCullKey, b: LightCullKey): boolean {
  return (
    a.itemCullMask === b.itemCullMask &&
    a.zMin === b.zMin &&
    a.zMax === b.zMax &&
    a.layerMin === b.layerMin &&
    a.layerMax === b.layerMax
  );
}

/**
 * A total order over cull keys, cull mask first and directional keys ahead of every mask. Sorted,
 * not mount-ordered, so a class's index, camera layer and uniform slot depend only on which keys
 * are present. With no range window authored, the order is the mask order.
 */
export function compareLightCullKeys(a: LightCullKey, b: LightCullKey): number {
  return (
    Number(b.itemCullMask === null) - Number(a.itemCullMask === null) ||
    (a.itemCullMask ?? 0) - (b.itemCullMask ?? 0) ||
    a.zMin - b.zMin ||
    a.zMax - b.zMax ||
    a.layerMin - b.layerMin ||
    a.layerMax - b.layerMax
  );
}
