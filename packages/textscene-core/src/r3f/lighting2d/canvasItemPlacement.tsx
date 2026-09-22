/**
 * Where a canvas item sits, as Godot's light cull test asks it: the item's
 * accumulated `z_final`, and the layer of the canvas it belongs to.
 *
 * Both are threaded down the tree rather than read off the node, because
 * neither is a property of the node alone.
 *
 * Z accumulates. `servers/rendering/renderer_canvas_cull.cpp`,
 * `_cull_canvas_item` (lines 816-820 on master):
 *
 *   int parent_z = p_z;
 *   if (ci->z_relative) {
 *       p_z = CLAMP(p_z + ci->z_index, RSE::CANVAS_ITEM_Z_MIN, RSE::CANVAS_ITEM_Z_MAX);
 *   } else {
 *       p_z = ci->z_index;
 *   }
 *
 * and `_attach_canvas_item_for_draw` (line 564) stores the result as
 * `ci->z_final`, which is the value the light's z window is tested against.
 * Note the asymmetry: only the accumulating branch clamps.
 *
 * The LAYER does not accumulate — it belongs to the canvas. The world canvas is
 * layer 0; a `CanvasLayer` starts a canvas of its own at its `layer` property,
 * whose Godot default is 1. That default is the whole reason an untouched light
 * (window 0..0) never lights an untouched HUD.
 *
 * These are contexts rather than parameters threaded through every slice
 * because only the light pass cares: a slice renders its pixels and stays
 * ignorant, exactly as it does of the accumulation buffers themselves.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import { createContext, useContext, type ReactNode } from 'react';
import { CANVAS_ITEM_Z_MIN, CANVAS_ITEM_Z_MAX } from '../../godot/rendering.js';

/**
 * Re-exported rather than re-typed: `godot/rendering.ts` owns the numbers and
 * the reasoning, and its docblock names a slice re-typing them as THE drift
 * risk. The clamp below and the linter's bounds must read one constant.
 */
export { CANVAS_ITEM_Z_MIN, CANVAS_ITEM_Z_MAX };

/** The world canvas's layer, which is where everything outside a CanvasLayer draws. */
export const WORLD_CANVAS_LAYER = 0;

/** `CanvasLayer.layer`'s own Godot default, for a layer that authors none. */
export const DEFAULT_CANVAS_LAYER = 1;

/**
 * One item's `z_final`, given its parent's and its own CanvasItem z properties.
 *
 * The ONE integer-z accumulation in the codebase: the y-sort pass buckets by the
 * same value, exactly as Godot does — `_collect_ysort_children` (lines 160-166)
 * and `_cull_canvas_item` (816-820) are the same six lines twice. The result is
 * read twice over: as the light cull's z window, and as the `z_final` term of
 * a canvas item's draw-order key (`canvasPaintOrder.ts`).
 */
export function accumulateCanvasItemZ(
  parentZ: number,
  props: { z_index: number; z_as_relative?: boolean }
): number {
  if (props.z_as_relative === false) return props.z_index;
  return Math.min(CANVAS_ITEM_Z_MAX, Math.max(CANVAS_ITEM_Z_MIN, parentZ + props.z_index));
}

const EffectiveZContext = createContext<number>(0);
EffectiveZContext.displayName = 'EffectiveZContext';

/**
 * The accumulated `z_final` of the enclosing canvas item. 0 outside a 2D stage,
 * which is both the world canvas's starting value and what every 3D consumer
 * and bare test mount reads.
 */
export function useEffectiveZ(): number {
  return useContext(EffectiveZContext);
}

export function EffectiveZProvider({ value, children }: { value: number; children: ReactNode }) {
  return <EffectiveZContext.Provider value={value}>{children}</EffectiveZContext.Provider>;
}

const CanvasLayerIndexContext = createContext<number>(WORLD_CANVAS_LAYER);
CanvasLayerIndexContext.displayName = 'CanvasLayerIndexContext';

/** The `layer` of the canvas the enclosing item draws on. */
export function useCanvasLayerIndex(): number {
  return useContext(CanvasLayerIndexContext);
}

export function CanvasLayerIndexProvider({
  value,
  children,
}: {
  value: number;
  children: ReactNode;
}) {
  return <CanvasLayerIndexContext.Provider value={value}>{children}</CanvasLayerIndexContext.Provider>;
}
