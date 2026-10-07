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
 * buffer only when no item can tell them apart: when every field agrees.
 */
export interface LightCullKey {
  /**
   * `Light2D.range_item_cull_mask`, ANDed against each CanvasItem's own `light_mask`. Not the
   * light node's `light_mask`, which is its CanvasItem mask and says nothing about what it lights.
   * Null for a directional light, which reaches every item, one with `light_mask = 0` included. No
   * mask can say that, since `mask & 0` is 0 for every mask.
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
  /** Which half of a light split by `splitByShadowReceivers` this is. Null on a whole light. */
  readonly shadowHalf: ShadowHalf | null;
}

/** One half of a light split by its `shadow_item_cull_mask`. */
export interface ShadowHalf {
  /** `Light2D.shadow_item_cull_mask`. */
  readonly mask: number;
  /** True for the shadowed half, whose items' `light_mask` meets `mask`. False for the rest. */
  readonly receives: boolean;
}

/**
 * An untouched `Light2D`'s window, from `LIGHT_2D_RANGE_DEFAULTS`. The z pair is wide but
 * still a window. The layer pair is narrow, which is why a default light never lights a default
 * CanvasLayer.
 */
export const DEFAULT_LIGHT_CULL_KEY: LightCullKey = { ...LIGHT_2D_RANGE_DEFAULTS, shadowHalf: null };

/**
 * The key of a DirectionalLight2D: every item, at any z, on a canvas in its layer window. The
 * renderer_rd `canvas.glsl:727-760` loop runs each directional light over every lit item, and
 * `renderer_viewport.cpp:678-684` filters the list per canvas by layer alone. An item's `z_final`
 * is clamped to the canvas z range, so that range is every z.
 */
export function directionalLightCullKey(layerMin: number, layerMax: number): LightCullKey {
  return {
    ...DEFAULT_LIGHT_CULL_KEY,
    itemCullMask: null,
    zMin: CANVAS_ITEM_Z_MIN,
    zMax: CANVAS_ITEM_Z_MAX,
    layerMin,
    layerMax,
  };
}

/** The keys a positional light registers: one, or two halves when its shadow can miss an item. */
export interface ShadowReceiverSplit {
  /** The key the light's shadowed quad draws under. */
  readonly shadowed: LightCullKey;
  /** The key of its shadowless quad, or null while every item it reaches takes the shadow. */
  readonly unshadowed: LightCullKey | null;
}

/**
 * `canvas.glsl:806` shadows an item only where its `light_mask` meets `shadow_item_cull_mask`
 * (`renderer_canvas_render_rd.cpp:2374`). While a cull-mask bit misses the shadow mask, an item can
 * take the light unshadowed, so the light splits into a shadowed and an unshadowed half. Whole, it
 * shares a class with a shadowless light. `shadowItemCullMask` is null for a light that casts nothing.
 */
export function splitByShadowReceivers(
  key: LightCullKey,
  shadowItemCullMask: number | null
): ShadowReceiverSplit {
  if (shadowItemCullMask === null || key.itemCullMask === null) return { shadowed: key, unshadowed: null };
  if ((key.itemCullMask & ~shadowItemCullMask) === 0) return { shadowed: key, unshadowed: null };
  return {
    shadowed: { ...key, shadowHalf: { mask: shadowItemCullMask, receives: true } },
    unshadowed: { ...key, shadowHalf: { mask: shadowItemCullMask, receives: false } },
  };
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
    itemLayer <= key.layerMax &&
    (key.shadowHalf === null || ((key.shadowHalf.mask & itemLightMask) !== 0) === key.shadowHalf.receives)
  );
}

/**
 * A canonical string for the tuple, for use as a Map key. Separated rather than
 * concatenated, so `(1, 11, …)` and `(11, 1, …)` cannot collide.
 */
export function lightCullKeyId(key: LightCullKey): string {
  return (
    `${key.itemCullMask}|${key.zMin}|${key.zMax}|${key.layerMin}|${key.layerMax}` +
    `|${shadowHalfId(key.shadowHalf)}`
  );
}

/** `-` for a whole light, else the mask behind `r` for the shadowed half or `e` for the rest. */
function shadowHalfId(half: ShadowHalf | null): string {
  if (half === null) return '-';
  return `${half.receives ? 'r' : 'e'}${half.mask}`;
}

export function sameLightCullKey(a: LightCullKey, b: LightCullKey): boolean {
  return (
    a.itemCullMask === b.itemCullMask &&
    a.zMin === b.zMin &&
    a.zMax === b.zMax &&
    a.layerMin === b.layerMin &&
    a.layerMax === b.layerMax &&
    sameShadowHalf(a.shadowHalf, b.shadowHalf)
  );
}

// Field by field, not through `shadowHalfId`: this runs per class per lookup on every render.
function sameShadowHalf(a: ShadowHalf | null, b: ShadowHalf | null): boolean {
  if (a === null || b === null) return a === b;
  return a.mask === b.mask && a.receives === b.receives;
}

/**
 * How many of the sorted `keys` the pass draws under `cap` classes. A split light's halves sort next
 * to each other, and a cut between them would light only the items its shadow reaches, so the cut
 * drops the shadowed half too.
 */
export function drawnClassCount(keys: readonly LightCullKey[], cap: number): number {
  if (keys.length <= cap) return keys.length;
  return keys[cap - 1]?.shadowHalf?.receives === true ? cap - 1 : cap;
}

/** Null ahead of every mask, then ascending. */
function compareOptionalMasks(a: number | null, b: number | null): number {
  return Number(b === null) - Number(a === null) || (a ?? 0) - (b ?? 0);
}

/** A whole light first, then the shadowed half ahead of the unshadowed one, then by mask. */
function compareShadowHalves(a: ShadowHalf | null, b: ShadowHalf | null): number {
  if (a === null || b === null) return Number(b === null) - Number(a === null);
  return Number(b.receives) - Number(a.receives) || a.mask - b.mask;
}

/**
 * A total order over cull keys, cull mask first and directional keys ahead of every mask. Sorted,
 * not mount-ordered, so a class's index, camera layer and uniform slot depend only on which keys
 * are present. With no range window authored and no light split, the order is the mask order.
 */
export function compareLightCullKeys(a: LightCullKey, b: LightCullKey): number {
  return (
    compareOptionalMasks(a.itemCullMask, b.itemCullMask) ||
    a.zMin - b.zMin ||
    a.zMax - b.zMax ||
    a.layerMin - b.layerMin ||
    a.layerMax - b.layerMax ||
    compareShadowHalves(a.shadowHalf, b.shadowHalf)
  );
}
