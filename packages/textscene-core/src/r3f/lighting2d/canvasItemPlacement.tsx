/**
 * Where a canvas item sits for Godot's light cull test: its accumulated `z_final` and the layer of
 * its canvas. Neither is a property of the node alone, so both come down the tree as contexts,
 * which only the light pass reads.
 */
/*
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import { createContext, useContext, type ReactNode } from 'react';
import { CANVAS_ITEM_Z_MIN, CANVAS_ITEM_Z_MAX } from '../../godot/rendering.js';

/**
 * Re-exported, not re-typed: `godot/rendering.ts` owns the numbers, and the clamp below and the
 * linter's bounds must read one constant.
 */
export { CANVAS_ITEM_Z_MIN, CANVAS_ITEM_Z_MAX };

/** The world canvas's layer, which is where everything outside a CanvasLayer draws. */
export const WORLD_CANVAS_LAYER = 0;

/** `CanvasLayer.layer`'s Godot default, which is why a default light (window 0..0) never lights a default HUD. */
export const DEFAULT_CANVAS_LAYER = 1;

/**
 * `_cull_canvas_item` (`servers/rendering/renderer_canvas_cull.cpp` lines 816-820 on master) clamps
 * only a `z_relative` sum, and `_attach_canvas_item_for_draw` (line 564) stores it as `z_final`. The
 * only z accumulation here: the y-sort pass (`_collect_ysort_children`, lines 160-166), the light
 * cull and the draw-order key (`canvasPaintOrder.ts`) all read it.
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
