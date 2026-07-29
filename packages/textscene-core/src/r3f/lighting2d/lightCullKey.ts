/**
 * Which items a 2D light reaches — Godot's whole test, and the class key it
 * forces on the accumulator.
 *
 * The per-ITEM half is one condition, in
 * `drivers/gles3/rasterizer_canvas_gles3.cpp`, `_record_item_commands` (line
 * 1347 on master):
 *
 *   if (light->render_index_cache >= 0 && p_item->light_mask & light->item_mask &&
 *       p_item->z_final >= light->z_min && p_item->z_final <= light->z_max &&
 *       p_item->global_rect_cache.intersects(light->rect_cache)) {
 *
 * The LAYER half is tested once per canvas rather than per item, in
 * `servers/rendering/renderer_viewport.cpp`, `_draw_viewport` (line 1220):
 *
 *   RendererCanvasRender::Light *ptr = lights;
 *   while (ptr) {
 *       if (E.value->layer >= ptr->layer_min && E.value->layer <= ptr->layer_max) {
 *           ptr->next_ptr = canvas_lights;
 *           canvas_lights = ptr;
 *       }
 *       ptr = ptr->filter_next_ptr;
 *   }
 *
 * where `E.value->layer` is the canvas's own layer — 0 for the world canvas,
 * the CanvasLayer's `layer` (Godot default 1) inside one. It decides whether the
 * light is handed to that canvas AT ALL, and it is cross-canvas: a light
 * declared anywhere lights every canvas whose layer falls in its range.
 *
 * Both comparisons are inclusive at both ends, and neither swaps an inverted
 * pair — `min > max` is simply an empty interval, since `Light2D`'s four setters
 * assign and forward with no CLAMP and no reordering. Confirmed on Godot 4.6.3
 * as well as read: with `range_z_max = 4`, a z_index-4 panel lights and a
 * z_index-5 one does not; with `range_z_min = 4` the z_index-4 panel still
 * lights and the z_index-0 one does not.
 *
 * WHY THIS IS A CLASS KEY. The light pass accumulates `S` for a whole SET of
 * lights into one screen-space buffer, and an item then multiplies its albedo by
 * what that buffer holds. Nothing downstream can subtract one light's
 * contribution back out per fragment, so two lights may only share a buffer when
 * no item can tell them apart. The five values above are the entire light side
 * of the test, so agreeing on all five is exactly that condition — and the
 * partition that used to be "by cull mask" becomes "by this tuple", with no
 * change for any light that leaves the four range properties at their defaults.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

/**
 * Everything a light contributes to Godot's cull test — and therefore the whole
 * identity of an accumulation class.
 */
export interface LightCullKey {
  /**
   * `Light2D.range_item_cull_mask`, ANDed against each CanvasItem's own
   * `light_mask`. NOT the light node's `light_mask`, which is its CanvasItem
   * mask and says nothing about what it lights.
   */
  readonly itemCullMask: number;
  /** `Light2D.range_z_min` — the lowest accumulated `z_index` this light reaches. */
  readonly zMin: number;
  /** `Light2D.range_z_max` — the highest, inclusive. */
  readonly zMax: number;
  /** `Light2D.range_layer_min` — the lowest CANVAS layer this light is handed to. */
  readonly layerMin: number;
  /** `Light2D.range_layer_max` — the highest, inclusive. */
  readonly layerMax: number;
}

/**
 * The window an untouched `Light2D` carries. `scene/2d/light_2d.h:50-55`:
 *
 *   int z_min = -1024;
 *   int z_max = 1024;
 *   int layer_min = 0;
 *   int layer_max = 0;
 *   int item_mask = 1;
 *
 * Confirmed on the engine as well: a fresh `PointLight2D` in Godot 4.6.3 reports
 * exactly those five values.
 *
 * The z pair is wide enough to go unnoticed on a scene whose z stays small, but
 * it is a window like any other; the layer pair is not wide at all, and is why a
 * default light never lights a default CanvasLayer.
 */
export const DEFAULT_LIGHT_CULL_KEY: LightCullKey = {
  itemCullMask: 1,
  zMin: -1024,
  zMax: 1024,
  layerMin: 0,
  layerMax: 0,
};

/**
 * Does this light reach this item?
 *
 * `itemZ` is Godot's `z_final` — the item's accumulated, clamped `z_index` (see
 * `canvasItemPlacement`) — and `itemLayer` is the layer of the CANVAS the item
 * belongs to, not a property of the item. JS `&` is a signed 32-bit operation
 * over exactly the 32 bits Godot compares, and `!== 0` reads the result the same
 * way `if` does in C++.
 */
export function lightReachesItem(
  key: LightCullKey,
  itemLightMask: number,
  itemZ: number,
  itemLayer: number
): boolean {
  return (
    (key.itemCullMask & itemLightMask) !== 0 &&
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

/** Do two keys describe the same class? */
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
 * A total order over cull keys, cull mask first.
 *
 * The classes are SORTED rather than mount-ordered so a class's index — and
 * therefore its camera layer and its slot in every item's uniform array —
 * depends only on WHICH keys are present, never on which light mounted first.
 * Leading with the mask keeps a scene that authors no range window ordered
 * exactly as it was when the mask alone was the key.
 */
export function compareLightCullKeys(a: LightCullKey, b: LightCullKey): number {
  return (
    a.itemCullMask - b.itemCullMask ||
    a.zMin - b.zMin ||
    a.zMax - b.zMax ||
    a.layerMin - b.layerMin ||
    a.layerMax - b.layerMax
  );
}
