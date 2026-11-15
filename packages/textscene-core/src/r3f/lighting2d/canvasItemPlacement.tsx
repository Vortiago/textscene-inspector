/**
 * Where a canvas item sits for Godot's light cull test: its accumulated `z_final`, which the canvas
 * item pass folds with `accumulateCanvasItemZ`, and the layer of its canvas, which comes down the
 * tree as a context.
 */
/*
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import { createContext, useContext, type ReactNode } from 'react';
import { CANVAS_ITEM_Z_MIN, CANVAS_ITEM_Z_MAX } from '../../godot/rendering/rendering.js';
import { clamp } from '../../godot/math/math.js';

/** The world canvas's layer, which is where everything outside a CanvasLayer draws. */
export const WORLD_CANVAS_LAYER = 0;

/**
 * `_cull_canvas_item` (`servers/rendering/renderer_canvas_cull.cpp` lines 816-820 on master) clamps
 * only a `z_relative` sum, and `_attach_canvas_item_for_draw` (line 564) stores it as `z_final`. The
 * only z accumulation here: the y-sort pass (`_collect_ysort_children`, lines 160-166), the light
 * cull and the draw-order key (`canvasPaintOrder.ts`) all read it.
 */
export function accumulateCanvasItemZ(
  parentZ: number,
  step: { zIndex: number; zAsRelative?: boolean }
): number {
  if (step.zAsRelative === false) return step.zIndex;
  return clampCanvasItemZ(parentZ + step.zIndex);
}

/** A z held inside the canvas z window, as `_cull_canvas_item` clamps a relative sum. */
export function clampCanvasItemZ(z: number): number {
  return clamp(z, CANVAS_ITEM_Z_MIN, CANVAS_ITEM_Z_MAX);
}

const CanvasLayerIndexContext = createContext<number>(WORLD_CANVAS_LAYER);
CanvasLayerIndexContext.displayName = 'CanvasLayerIndexContext';

/** The `layer` of the canvas the enclosing item draws on. */
export function useCanvasLayerIndex(): number {
  return useContext(CanvasLayerIndexContext);
}

export function CanvasLayerIndexProvider({ value, children }: { value: number; children: ReactNode }) {
  return <CanvasLayerIndexContext.Provider value={value}>{children}</CanvasLayerIndexContext.Provider>;
}
