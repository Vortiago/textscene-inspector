/**
 * Godot's 2D canvas draw order, as one integer per canvas item.
 *
 * Godot draws a canvas in a single pre-order walk that appends each visible
 * item to a linked list indexed by the item's accumulated `z_final`
 * (`_attach_canvas_item_for_draw`, `servers/rendering/renderer_canvas_cull.cpp`
 * lines 274-283), then draws those lists in z order. The order key is therefore
 * exactly three things, in this precedence:
 *
 *   (canvas layer, z_final, position in the walk)
 *
 * and an item's node TYPE is in none of them. A `Control` and a `Sprite2D` are
 * both `CanvasItem`s; they interleave purely by the key above. The impression
 * that "UI draws over the world" is a convention of how scenes are authored,
 * not a rule of the renderer — a background `ColorRect` authored as the first
 * child of a root draws UNDER the sprites that follow it.
 *
 * ---- Why one integer -----------------------------------------------------
 *
 * three decides what covers what in `reversePainterSortStable`
 * (`three/src/renderers/webgl/WebGLRenderLists.js`): `groupOrder`, then
 * `renderOrder`, then view distance, then object id. Every 2D material here is
 * `transparent` + `depthWrite={false}`, so that comparator is the whole story —
 * the depth buffer resolves nothing. `groupOrder` is the `renderOrder` of the
 * nearest enclosing `Group` (`WebGLRenderer.js:1838-1840`), so a canvas item's
 * wrapper group carries this key for everything the item draws, and the meshes
 * INSIDE it keep their own small `renderOrder` for the item's private layering
 * (an atlas batch's source index, a widget's chrome). Two ordinal levels, which
 * is exactly what the two rules need — the key never has to make room for
 * sub-item detail.
 *
 * This replaces a scheme that encoded draw order as a fractional `+Z` offset
 * (`z_index × 0.1`, with y-sort ranks and tile sub-steps dividing what was left
 * of each step). That approach could only ever approximate the order: the
 * budget shrank with every level of nesting, so the machinery that rationed it
 * grew alongside — and the plain, un-y-sorted case had no draw sequence at all,
 * falling back to `Object3D.id` mount order, which is why a Control mounted in
 * its own pass could never interleave with the world.
 *
 * ---- Ranges --------------------------------------------------------------
 *
 * Sequence values are handed out as CONTIGUOUS RANGES: a node owns
 * `[base, base + size)` and its descendants are allocated inside it. That is
 * what lets a y-sort pass re-order the items it collected without consulting
 * anything outside its own subtree — it re-packs its own range — and it is why
 * `size` counts the whole subtree rather than one value per node.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import type { TscnNode } from '../parser/types';
import {
  CANVAS_ITEM_Z_MAX,
  CANVAS_ITEM_Z_MIN,
  WORLD_CANVAS_LAYER,
} from './lighting2d/canvasItemPlacement';

/** How many distinct `z_final` buckets one canvas has. */
const Z_BUCKET_COUNT = CANVAS_ITEM_Z_MAX - CANVAS_ITEM_Z_MIN + 1;

/**
 * Sequence values available to one `(layer, z_final)` bucket — the ceiling on
 * how many canvas items a single scene may draw in one bucket.
 *
 * Sized so that a scene's whole key stays a SAFE integer: three compares
 * `renderOrder` with `!==`, so a key that lost precision would silently tie
 * items that must not tie. The largest key is
 * `layerRanks × Z_BUCKET_COUNT × PAINT_SEQUENCE_STRIDE`, and ranks are bounded
 * by the number of distinct `CanvasLayer.layer` values a scene declares — so
 * even a thousand of them against the full ±4096 z envelope stays four orders
 * of magnitude under `Number.MAX_SAFE_INTEGER`.
 */
export const PAINT_SEQUENCE_STRIDE = 2 ** 24;

/**
 * Sequence values held back inside a node whose drawn pieces are not listed in
 * the tree — see `reservesRoom`.
 *
 * Every other node's range is just its subtree's node count, which the tree
 * states outright. Reserving this room up front is what keeps the allocation a
 * PURE function of the tree: the world walk and the Control walk each derive it
 * from the same nodes, so they agree without talking to each other, and neither
 * has to wait for a resource to resolve before it can place anything.
 */
export const DYNAMIC_CHILD_RESERVE = 4096;

/** A contiguous run of draw-sequence values owned by one node and its subtree. */
export interface PaintRange {
  base: number;
  size: number;
}

/** Where a canvas item sits in Godot's three-part order. */
export interface CanvasPlacement {
  /** The item's canvas, as a dense rank — see `layerRanks`. */
  layerRank: number;
  /** The item's accumulated `z_index` (`accumulateCanvasItemZ`). */
  zFinal: number;
  /** The item's position in the draw walk, from `allocatePaintRange`. */
  sequence: number;
}

/** The range a whole canvas starts from, before any node has been allocated. */
export const WHOLE_CANVAS_RANGE: PaintRange = { base: 0, size: PAINT_SEQUENCE_STRIDE };

/**
 * The `renderOrder` a canvas item's wrapper group takes.
 *
 * Lexicographic `(layerRank, zFinal, sequence)` packed into one integer, so
 * three's single integer comparison reproduces all three of Godot's rules at
 * once. `zFinal` is clamped to the canvas envelope for the same reason Godot
 * clamps it while accumulating (`_cull_canvas_item` lines 432-434): a value
 * past the envelope would index into the next layer's buckets.
 */
export function canvasRenderOrder({ layerRank, zFinal, sequence }: CanvasPlacement): number {
  const clamped = Math.min(CANVAS_ITEM_Z_MAX, Math.max(CANVAS_ITEM_Z_MIN, zFinal));
  const bucket = layerRank * Z_BUCKET_COUNT + (clamped - CANVAS_ITEM_Z_MIN);
  // A sequence past the stride would carry into the NEXT bucket and put the
  // item on a z or layer it does not belong to — a silent, structural
  // inversion rather than a near-miss. Saturating instead keeps it inside its
  // own bucket, where the worst case is a tie with its neighbours. Only a
  // scene declaring thousands of `reservesRoom` nodes can reach this.
  const bounded = Math.min(sequence, PAINT_SEQUENCE_STRIDE - 1);
  return bucket * PAINT_SEQUENCE_STRIDE + bounded;
}

/**
 * Dense ranks for the canvas layers a scene declares, lowest layer first.
 *
 * `CanvasLayer.layer` is a plain int32 assignment in Godot
 * (`CanvasLayer::set_layer`, `scene/main/canvas_layer.cpp` — its
 * `PROPERTY_HINT_RANGE` is an editor-slider hint, not a clamp), so the raw
 * value cannot be a coefficient in the key: its envelope alone would exhaust
 * the safe-integer budget. Only its ORDER carries meaning, and ranking is what
 * keeps the key's magnitude tied to how many layers a scene really has.
 *
 * The world canvas (layer 0) is always ranked, whether or not any `CanvasLayer`
 * node declares it — it is where everything outside one draws.
 */
export function layerRanks(layers: Iterable<number>): readonly number[] {
  return [...new Set([WORLD_CANVAS_LAYER, ...layers])].sort((a, b) => a - b);
}

/**
 * `layer`'s rank among `declared`, strictly ordered by the layer's VALUE.
 *
 * Total by construction rather than a map lookup with a fallback: a
 * `CanvasLayer` inside an INSTANCED sub-scene is not in the tree
 * `declaredCanvasLayers` walked, so a miss is reachable, and answering it with
 * rank 0 would drop that layer under every other one instead of ordering it.
 *
 * Ranks are spaced by two so an undeclared layer has a slot of its own between
 * the declared ones it falls between: a declared layer takes the ODD rank
 * `2i + 1`, an undeclared one the EVEN rank `2k` below the first declared layer
 * above it. Without the spacing an undeclared layer ties with that neighbour,
 * and two canvases that tie interleave item-by-item instead of each drawing
 * whole — which is the one thing a canvas layer exists to prevent.
 */
export function layerRankOf(declared: readonly number[], layer: number): number {
  let below = 0;
  let isDeclared = false;
  for (const candidate of declared) {
    if (candidate < layer) below++;
    else if (candidate === layer) isDeclared = true;
  }
  return isDeclared ? below * 2 + 1 : below * 2;
}

/**
 * Node types that START A CANVAS of their own — Godot's `CanvasLayer` and every
 * subclass of it. `ParallaxBackground extends CanvasLayer`
 * (`scene/2d/parallax_background.h`), so its `layer` orders its subtree against
 * the rest of the canvases exactly as a plain `CanvasLayer`'s does; matching on
 * the literal type name alone silently left it on the world canvas.
 */
export const CANVAS_LAYER_TYPES: ReadonlySet<string> = new Set([
  'CanvasLayer',
  'ParallaxBackground',
]);

/** The `layer` a canvas-layer node declares, or Godot's own default of 1. */
export function canvasLayerOf(node: TscnNode): number {
  const layer = (node.properties as { layer?: number }).layer;
  return typeof layer === 'number' ? layer : DEFAULT_CANVAS_LAYER_VALUE;
}

/** Every canvas layer declared anywhere in the given trees. */
export function declaredCanvasLayers(nodes: readonly TscnNode[]): number[] {
  const found: number[] = [];
  const visit = (node: TscnNode): void => {
    if (CANVAS_LAYER_TYPES.has(node.type)) found.push(canvasLayerOf(node));
    for (const child of node.children) visit(child);
  };
  for (const node of nodes) visit(node);
  return found;
}

/** `CanvasLayer.layer`'s own Godot default, for a layer node that authors none. */
const DEFAULT_CANVAS_LAYER_VALUE = 1;

/**
 * Whether a node draws pieces the tree does not list, and so needs room held
 * back for them.
 *
 * Two kinds qualify, for the same reason: what they draw is only known once
 * something outside the tree resolves.
 *
 *  - A tile layer, which a y-sort pass decomposes into one group per distinct
 *    tile row once the tileset loads.
 *  - An `instance=` node, whose sub-scene roots are injected as children once
 *    the PackedScene loads.
 */
function reservesRoom(node: TscnNode): boolean {
  return node.type === 'TileMapLayer' || node.type === 'TileMap' || node.instance !== undefined;
}

/**
 * How many sequence values `node`'s subtree needs.
 *
 * Every node counts, not only the canvas items among them. Over-allocating is
 * free — ranges only have to be ordered and non-overlapping — while deciding
 * "is this a canvas item" here would be a second definition of that question,
 * one the world walk and the Control walk could disagree on. They call this,
 * so they cannot.
 */
export function paintRangeSize(node: TscnNode): number {
  let size = reservesRoom(node) ? DYNAMIC_CHILD_RESERVE : 1;
  for (const child of node.children) size += paintRangeSize(child);
  return size;
}

/** A parent's own sequence value, and the range each of its children owns. */
export interface AllocatedPaintRange {
  /** The sequence the parent itself draws at. */
  self: number;
  /** One range per child, positionally matching the `children` passed in. */
  children: PaintRange[];
  /**
   * What is left of the range after the children — the room `reservesRoom`
   * held back. Sub-scene roots injected by an `instance=` node are allocated
   * from here, so they draw after the node's authored children, as they do in
   * the tree Godot would have built.
   */
  tail: PaintRange;
}

/** `show_behind_parent`, under either casing the two parsers produce. */
function drawsBehindParent(node: TscnNode): boolean {
  const props = node.properties as { show_behind_parent?: boolean; showBehindParent?: boolean };
  // `Node2DProperties` keeps the `.tscn` snake_case; `ControlProperties` is
  // camelCase. Reading one key alone silently ignored the flag on every
  // Control, which is a `CanvasItem` and honours it exactly as a Node2D does.
  return props.show_behind_parent === true || props.showBehindParent === true;
}

/**
 * Split `range` between the node that owns it and its children, in draw order.
 *
 * `_cull_canvas_item` (lines 477-490) visits a node's `show_behind_parent`
 * children, then attaches the node itself, then its remaining children — so the
 * behind-children take the front of the range and the parent's own sequence
 * sits after them. Children keep their authored order within each group, which
 * is the walk's order.
 *
 * `sortsChildren` is for a `y_sort_enabled` parent, whose children are NOT
 * visited by those two loops at all: `_cull_canvas_item` takes the
 * `_collect_ysort_children` branch instead and re-orders the whole merged
 * subtree by Y. The behind/ahead split is therefore meaningless there, and
 * applying it anyway pushes the parent's own sequence past `range.base` — which
 * the y-sort pass then packs its items AFTER, overrunning the end of the very
 * range it was given and colliding with the next sibling's.
 */
export function allocatePaintRange(
  range: PaintRange,
  children: readonly TscnNode[],
  sortsChildren = false
): AllocatedPaintRange {
  const behind = children.map((child) => !sortsChildren && drawsBehindParent(child));
  const sizes = fitToRange(children.map(paintRangeSize), range.size);
  const end = range.base + range.size;

  let cursor = range.base;
  const allocated: PaintRange[] = new Array<PaintRange>(children.length);
  /** Never past `end`: an overrun would land inside the NEXT sibling's range. */
  const take = (size: number): PaintRange => {
    const base = Math.min(cursor, Math.max(range.base, end - 1));
    const taken = Math.max(0, Math.min(size, end - base));
    cursor = base + taken;
    return { base, size: taken };
  };

  for (let i = 0; i < children.length; i++) {
    if (!behind[i]) continue;
    allocated[i] = take(sizes[i]!);
  }
  const self = Math.min(cursor, Math.max(range.base, end - 1));
  cursor = self + 1;
  for (let i = 0; i < children.length; i++) {
    if (behind[i]) continue;
    allocated[i] = take(sizes[i]!);
  }
  return {
    self,
    children: allocated,
    tail: { base: Math.min(cursor, end), size: Math.max(0, end - cursor) },
  };
}

/**
 * The children's sizes scaled to fit `available`, leaving one value for the
 * parent itself.
 *
 * `paintRangeSize` is a pure function of the HOST tree, which is what lets the
 * world walk and the Control walk agree without either resolving a resource —
 * but it means a dynamic node's reserve is a guess, and a sub-scene carrying a
 * `TileMapLayer` of its own already needs more than one. Scaling keeps the
 * subtree's own order for as long as the room lasts, and — the part that
 * matters — keeps it out of the next sibling's range, where an overrun reorders
 * nodes that have nothing to do with it.
 */
function fitToRange(sizes: readonly number[], available: number): number[] {
  const needed = sizes.reduce((sum, size) => sum + size, 0);
  const room = Math.max(0, available - 1);
  if (needed <= room) return [...sizes];
  const scale = needed > 0 ? room / needed : 0;
  return sizes.map((size) => Math.max(1, Math.floor(size * scale)));
}

/**
 * `sizes` laid out in order from `from`, scaled and clamped so the last one
 * still ends inside `range`.
 *
 * For a pass that re-packs a range over items the tree does not list — the
 * y-sort expansion of a tile layer into one group per row — where the count is
 * only known once a resource resolves, and so cannot have been reserved for
 * exactly.
 */
export function packPaintRanges(
  range: PaintRange,
  sizes: readonly number[],
  from: number
): PaintRange[] {
  const end = range.base + range.size;
  const fitted = fitToRange(sizes, Math.max(0, end - from) + 1);
  let cursor = from;
  return fitted.map((size) => {
    const base = Math.min(cursor, Math.max(range.base, end - 1));
    const taken = Math.max(0, Math.min(size, end - base));
    cursor = base + taken;
    return { base, size: taken };
  });
}
