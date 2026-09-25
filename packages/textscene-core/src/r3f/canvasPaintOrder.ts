/**
 * Godot's 2D canvas draw order, as one integer per canvas item. The key is (canvas layer,
 * `z_final`, position in the pre-order walk), and an item's node type is in none of it. Each
 * item's wrapper group carries the key as its three `renderOrder`. `canvasPaintOrder.md` derives
 * the key and the ranges a node owns.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import type { TscnNode } from '../parser/types';
import { descendsFrom } from '../godot/nodeBaseTypes';
import { isViewportBoundary } from '../nodes/viewport/subviewport/viewportBoundary';
import {
  CANVAS_ITEM_Z_MAX,
  CANVAS_ITEM_Z_MIN,
  WORLD_CANVAS_LAYER,
} from './lighting2d/canvasItemPlacement';

/** How many distinct `z_final` buckets one canvas has. */
const Z_BUCKET_COUNT = CANVAS_ITEM_Z_MAX - CANVAS_ITEM_Z_MIN + 1;

/**
 * Sequence values in one `(layer, z_final)` bucket. The largest key,
 * `layerRanks × Z_BUCKET_COUNT × PAINT_SEQUENCE_STRIDE`, must stay a safe integer,
 * or items tie: a thousand layers against the ±4096 z envelope stay four orders
 * of magnitude under `Number.MAX_SAFE_INTEGER`.
 */
export const PAINT_SEQUENCE_STRIDE = 2 ** 24;

/**
 * Room held back inside a node whose drawn pieces the tree does not list
 * (`reservesRoom`). It keeps the allocation a pure function of the tree, so the
 * world walk and the Control walk agree without waiting on a resource.
 */
export const DYNAMIC_CHILD_RESERVE = 4096;

/** A contiguous run of draw-sequence values owned by one node and its subtree. */
export interface PaintRange {
  base: number;
  size: number;
}

/** Where a canvas item sits in Godot's three-part order. */
export interface CanvasPlacement {
  /** The item's canvas, as a dense rank (`layerRanks`). */
  layerRank: number;
  /** The item's accumulated `z_index` (`accumulateCanvasItemZ`). */
  zFinal: number;
  /** The item's position in the draw walk, from `allocatePaintRange`. */
  sequence: number;
}

/** The range a whole canvas starts from, before any node has been allocated. */
export const WHOLE_CANVAS_RANGE: PaintRange = { base: 0, size: PAINT_SEQUENCE_STRIDE };

/**
 * The `renderOrder` of a canvas item's wrapper group: `(layerRank, zFinal,
 * sequence)` packed into one integer. `zFinal` is clamped as Godot clamps it
 * (`_cull_canvas_item` lines 432-434), or it indexes the next layer's buckets.
 */
export function canvasRenderOrder({ layerRank, zFinal, sequence }: CanvasPlacement): number {
  const clamped = Math.min(CANVAS_ITEM_Z_MAX, Math.max(CANVAS_ITEM_Z_MIN, zFinal));
  const bucket = layerRank * Z_BUCKET_COUNT + (clamped - CANVAS_ITEM_Z_MIN);
  // Saturated: a sequence past the stride carries into the next bucket, a wrong
  // z or layer. Inside its own bucket the worst case is a tie with a neighbour.
  // Only a scene with thousands of `reservesRoom` nodes reaches it.
  const bounded = Math.min(sequence, PAINT_SEQUENCE_STRIDE - 1);
  return bucket * PAINT_SEQUENCE_STRIDE + bounded;
}

/**
 * Dense ranks for the declared canvas layers, lowest first, always with the
 * world canvas (layer 0). `CanvasLayer.layer` is an unclamped int32
 * (`scene/main/canvas_layer.cpp`), and as a raw coefficient it would exhaust the
 * safe-integer budget.
 */
export function layerRanks(layers: Iterable<number>): readonly number[] {
  return [...new Set([WORLD_CANVAS_LAYER, ...layers])].sort((a, b) => a - b);
}

/**
 * `layer`'s rank among `declared`, by value. A layer in an instanced sub-scene
 * is undeclared, and rank 0 would drop it under every other layer.
 */
export function layerRankOf(declared: readonly number[], layer: number): number {
  // A declared layer takes the odd rank `2i + 1`, an undeclared one the even
  // rank below the next declared layer. A tie would interleave two canvases
  // item by item instead of drawing each whole.
  let below = 0;
  let isDeclared = false;
  for (const candidate of declared) {
    if (candidate < layer) below++;
    else if (candidate === layer) isDeclared = true;
  }
  return isDeclared ? below * 2 + 1 : below * 2;
}

/**
 * Whether this type starts a canvas of its own: `_enter_canvas` climbs to
 * `Object::cast_to<CanvasLayer>(n)` (`canvas_item.cpp:246-252`). Derived from
 * ClassDB, so a subclass such as `ParallaxBackground` (`parallax_background.h:34`)
 * counts. `controls/canvasBoundary.driftguard.test.ts` holds the Control walk to it.
 */
export function isCanvasLayerType(type: string): boolean {
  return descendsFrom(type, 'CanvasLayer');
}

/** The `layer` a canvas-layer node declares, or Godot's own default of 1. */
export function canvasLayerOf(node: TscnNode): number {
  const layer = (node.properties as { layer?: number }).layer;
  return typeof layer === 'number' ? layer : DEFAULT_CANVAS_LAYER_VALUE;
}

/** Every canvas layer declared anywhere in the given trees. */
export function declaredCanvasLayers(nodes: readonly TscnNode[]): number[] {
  const found: number[] = [];
  const visit = (node: TscnNode): void => {
    if (isCanvasLayerType(node.type)) found.push(canvasLayerOf(node));
    for (const child of node.children) visit(child);
  };
  for (const node of nodes) visit(node);
  return found;
}

/** `CanvasLayer.layer`'s own Godot default, for a layer node that authors none. */
const DEFAULT_CANVAS_LAYER_VALUE = 1;

/**
 * Whether a node draws pieces the tree does not list: a tile layer, which a
 * y-sort pass splits into one group per tile row once the tileset loads, and an
 * `instance=` node, whose sub-scene roots arrive once the PackedScene loads.
 */
function reservesRoom(node: TscnNode): boolean {
  return node.type === 'TileMapLayer' || node.type === 'TileMap' || node.instance !== undefined;
}

/**
 * How many sequence values `node`'s subtree needs. Every node counts, not only
 * the canvas items: over-allocating is free, and a canvas-item test here would
 * be a second definition the two walks could disagree on.
 */
export function paintRangeSize(node: TscnNode): number {
  let size = reservesRoom(node) ? DYNAMIC_CHILD_RESERVE : 1;
  for (const child of node.children) size += paintRangeSize(child);
  // A canvas root nested under this item draws after its whole subtree, from
  // room held at the end of its run.
  if (isCanvasItem(node)) {
    for (const root of nestedCanvasRoots(node)) size += paintRangeSize(root);
  }
  return size;
}

/**
 * Whether `Object::cast_to<CanvasItem>` accepts this node. `get_parent_item()`
 * applies it to the direct parent (`canvas_item.cpp:565-571`) to decide whether
 * an item nests under it or parents at the canvas.
 */
function isCanvasItem(node: TscnNode): boolean {
  return descendsFrom(node.type, 'CanvasItem');
}

/**
 * `top_level`, under either casing: `Node2DProperties` keeps the `.tscn`
 * snake_case, and `ControlProperties` is camelCase.
 */
export function isTopLevelItem(node: TscnNode): boolean {
  const props = node.properties as { top_level?: boolean; topLevel?: boolean };
  return props.top_level === true || props.topLevel === true;
}

/**
 * Whether this item parents at the canvas. `get_parent_item()` returns nullptr
 * when the parent fails the cast, or when `top_level` skips it
 * (`canvas_item.cpp:565-571`), and `_enter_canvas` treats both alike
 * (`canvas_item.cpp:234-285`). One predicate, since Godot asks one question.
 */
export function isCanvasRoot(node: TscnNode, parentIsCanvasItem: boolean): boolean {
  return isCanvasItem(node) && (!parentIsCanvasItem || isTopLevelItem(node));
}

/**
 * Whether this node owns a canvas, so the roots below it are ordered against
 * its roots: a `CanvasLayer` (`canvas_item.cpp:259-262`) or a sub-viewport (ADR-0033).
 */
function hostsOwnCanvas(node: TscnNode): boolean {
  return isCanvasLayerType(node.type) || isViewportBoundary(node.type);
}

/**
 * The canvas roots under `node` in pre-order: each item `_enter_canvas` parents
 * at the canvas (`canvas_item.cpp:246-267`). The descent stops at each root, whose
 * own nested roots ride in its range, and at a node that hosts a canvas.
 */
export function nestedCanvasRoots(node: TscnNode): TscnNode[] {
  const found: TscnNode[] = [];
  const visit = (parent: TscnNode): void => {
    const parentIsItem = isCanvasItem(parent);
    for (const child of parent.children) {
      if (hostsOwnCanvas(child) || opaqueToCanvasRoots(child)) continue;
      if (isCanvasRoot(child, parentIsItem)) found.push(child);
      else visit(child);
    }
  };
  visit(node);
  return found;
}

/**
 * Whether the host tree cannot see the canvas parenting below this node: an
 * `instance=` node takes the sub-scene's type and children. Its subtree keeps
 * the run its nesting gives it.
 */
function opaqueToCanvasRoots(node: TscnNode): boolean {
  return node.instance !== undefined;
}

/**
 * Where each canvas root of one canvas draws, keyed by its node. `children` and
 * `ranges` are the host's children and the runs `allocatePaintRange` gave them.
 * Each root keeps its run less the tail its nested roots hold.
 */
export function canvasRootRanges(
  children: readonly TscnNode[],
  ranges: readonly PaintRange[]
): ReadonlyMap<TscnNode, PaintRange> {
  // A root's index comes from the canvas's counter (`canvas_item.cpp:222-232`),
  // handed out over the `_root_canvas` group (`canvas_item.cpp:453-466`) in tree
  // pre-order (`scene_tree.cpp:333-348`, `node.cpp:2152-2187`). Each root draws
  // whole (`renderer_canvas_cull.cpp:494-511`), so a nested root takes the tail.
  const out = new Map<TscnNode, PaintRange>();
  const addRoot = (root: TscnNode, range: PaintRange): void => {
    const nested = nestedCanvasRoots(root);
    const sizes = nested.map(paintRangeSize);
    const reserve = sizes.reduce((sum, size) => sum + size, 0);
    const end = range.base + range.size;
    // Never the whole run: the root itself still needs a value of its own.
    const from = reserve > 0 ? Math.min(end, Math.max(range.base + 1, end - reserve)) : end;
    out.set(root, { base: range.base, size: from - range.base });
    const packed = packPaintRanges(range, sizes, from);
    nested.forEach((child, i) => addRoot(child, packed[i]!));
  };
  const visit = (node: TscnNode, range: PaintRange): void => {
    if (hostsOwnCanvas(node) || opaqueToCanvasRoots(node)) return;
    if (isCanvasItem(node)) {
      addRoot(node, range);
      return;
    }
    // Not an item: its canvas-item children are the roots, at their pre-order runs.
    const allocated = allocatePaintRange(range, node.children);
    node.children.forEach((child, i) => visit(child, allocated.children[i]!));
  };
  children.forEach((child, i) => {
    const range = ranges[i];
    if (range) visit(child, range);
  });
  return out;
}

/** A parent's own sequence value, and the range each of its children owns. */
export interface AllocatedPaintRange {
  /** The sequence the parent itself draws at. */
  self: number;
  /** One range per child, positionally matching the `children` passed in. */
  children: PaintRange[];
  /**
   * The room `reservesRoom` held back after the children. Injected sub-scene
   * roots draw from here, after the authored children, as in Godot's tree.
   */
  tail: PaintRange;
}

/** `show_behind_parent`, under either casing the two parsers produce. */
function drawsBehindParent(node: TscnNode): boolean {
  const props = node.properties as { show_behind_parent?: boolean; showBehindParent?: boolean };
  // A Control, whose properties are camelCase, honours the flag as a Node2D does.
  return props.show_behind_parent === true || props.showBehindParent === true;
}

/**
 * Splits `range` between its node and the children, in draw order.
 * `_cull_canvas_item` (lines 477-490) visits the `show_behind_parent` children,
 * then the node, then the other children, each group in authored order.
 */
export function allocatePaintRange(
  range: PaintRange,
  children: readonly TscnNode[],
  sortsChildren = false
): AllocatedPaintRange {
  // A `y_sort_enabled` parent takes `_collect_ysort_children` instead, so it has
  // no behind split. With one, its sequence moves past `range.base` and the
  // y-sort pass overruns into the next sibling's range.
  const behind = children.map((child) => !sortsChildren && drawsBehindParent(child));
  const sizes = fitToRange(children.map(paintRangeSize), range.size);
  const end = range.base + range.size;

  let cursor = range.base;
  const allocated: PaintRange[] = new Array<PaintRange>(children.length);
  /** Never past `end`: an overrun would land inside the next sibling's range. */
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
 * The children's sizes scaled to fit `available`, with one value left for the
 * parent. A dynamic node's reserve is a guess, and scaling keeps an overrun out
 * of the next sibling's range, where it would reorder unrelated nodes.
 */
function fitToRange(sizes: readonly number[], available: number): number[] {
  const needed = sizes.reduce((sum, size) => sum + size, 0);
  const room = Math.max(0, available - 1);
  if (needed <= room) return [...sizes];
  const scale = needed > 0 ? room / needed : 0;
  return sizes.map((size) => Math.max(1, Math.floor(size * scale)));
}

/**
 * `sizes` laid out from `from`, scaled so the last one ends inside `range`. For
 * a pass over items the tree does not list, such as a tile layer's y-sort rows,
 * whose count is known only once a resource resolves.
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
