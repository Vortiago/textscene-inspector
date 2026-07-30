/**
 * Deterministic paint order for native (WebGL canvas) Controls, expressed as
 * a plain `THREE.Object3D.renderOrder` rather than a z offset.
 *
 * Every 2D canvas material in this codebase is `transparent` +
 * `depthWrite={false}` (the shared "flat 2D" recipe — `StyleBoxQuad`,
 * `Polygon2D`, and every native Control chrome to come), so nothing ever
 * writes depth and paint order is decided ENTIRELY by three's
 * transparent-object sort, which compares `renderOrder` BEFORE camera
 * distance. A Control therefore takes its paint position from `renderOrder`
 * alone and leaves its wrapper group's z at 0 (`ControlCanvasWalker.tsx`).
 *
 * A fractional-z scheme (packing layer + paint index into the group's z
 * position instead) was considered and rejected on arithmetic: the 2D world
 * camera sits at `position:[0,0,1000]`, `near:0.1`, `far:4000`
 * (`World2DCanvas.tsx`), so usable z is `(-3000, 999.9)`, and 2D world
 * content already spans z `±409.6` (`canvasItemZ` × `Z_INDEX_STEP` 0.1,
 * `node2dTransform.ts`) — no room left for a second per-layer banding scheme
 * on top of that one.
 *
 * ---- Bands ------------------------------------------------------------
 *
 * `renderOrder = bandBase(layer) + paintIndex`, where `paintIndex` is
 * `SolvedControl.paintIndex` (`controlRectSolver.ts`'s `assignPaintIndex`) —
 * ONE pre-order counter across the WHOLE Control tree passed to a single
 * solve, never reset per `CanvasLayer`. A layer's band must therefore be
 * wide enough to hold every paint index the ENTIRE tree could produce, since
 * one `CanvasLayer` could plausibly host every Control in the scene.
 *
 * `layer` is the `CanvasLayerIndexContext` value in force at a Control's
 * position (`lighting2d/canvasItemPlacement.ts`): `WORLD_CANVAS_LAYER` (0)
 * with no enclosing `CanvasLayer` node, a `CanvasLayer`'s own `layer`
 * property otherwise (Godot default 1, `DEFAULT_CANVAS_LAYER`).
 *
 * `bandBase` deliberately never produces band 0: `layer >=
 * WORLD_CANVAS_LAYER` maps to band `layer + 1`, so the untouched "no
 * CanvasLayer" case (`layer === WORLD_CANVAS_LAYER`) lands in band 1 — a
 * whole band ABOVE world content's own default `renderOrder` 0, matching
 * Godot: an ordinary UI root on the default canvas still paints after the 2D
 * world within it. `layer < WORLD_CANVAS_LAYER` maps to band `layer`
 * unchanged, staying negative (Godot's `layer < 0` draws BEFORE/under the
 * world). Skipping band 0 means nothing this function produces can ever
 * collide with the world's own default `renderOrder` (0), by construction —
 * not by a runtime check.
 *
 * ---- The stride ---------------------------------------------------------
 *
 * `DRAW_ORDER_BAND_STRIDE` clears two, opposite bounds:
 *
 *  - Large enough that no single band's accumulated paint indices can ever
 *    spill into its neighbour. There is no per-layer count to bound this
 *    against — only "however many Controls the whole scene has" — so the
 *    stride must exceed that.
 *  - Small enough that `bandBase` stays inside `Number.MAX_SAFE_INTEGER`
 *    (2**53 - 1) even at the extremes of what `CanvasLayer.layer` can
 *    represent. That property is NOT clamped by Godot at the value level
 *    (`CanvasLayer::set_layer`, `scene/main/canvas_layer.cpp`, a plain
 *    assignment) — its `PROPERTY_HINT_RANGE` is an editor-slider hint, the
 *    exact trap this design must not repeat for `z_index`. But the hint's
 *    bounds (`RS::CANVAS_LAYER_MIN`/`CANVAS_LAYER_MAX`,
 *    `servers/rendering/rendering_server.h` — Godot's full int32 range,
 *    ±2147483648) are still the documented envelope the property is FOR, and
 *    are what this stride is sized against: `2**20` keeps `bandBase` under
 *    `2**31 * 2**20 = 2**51`, comfortably below `2**53`, for every `layer` in
 *    that entire envelope — while `2**20` (over one million) is still far
 *    more paint indices than any one CanvasLayer's worth of Controls could
 *    plausibly assign.
 */

import { WORLD_CANVAS_LAYER } from '../../lighting2d/canvasItemPlacement.js';

/**
 * Paint-order band width — see the module doc's "The stride" section for
 * both bounds this value has to clear at once.
 */
export const DRAW_ORDER_BAND_STRIDE = 2 ** 20;

/** Band index for a `CanvasLayerIndexContext` value — never 0 (see module doc). */
function bandIndex(layer: number): number {
  return layer >= WORLD_CANVAS_LAYER ? layer + 1 : layer;
}

/** The first `renderOrder` value available to `layer`'s band; add `paintIndex` on top. */
export function bandBase(layer: number): number {
  return bandIndex(layer) * DRAW_ORDER_BAND_STRIDE;
}

/** `renderOrder` for a Control at `layer` with the solver's `paintIndex`. */
export function controlRenderOrder(layer: number, paintIndex: number): number {
  return bandBase(layer) + paintIndex;
}
