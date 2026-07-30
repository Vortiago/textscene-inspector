/**
 * The Control rect solve. Pure TS port of Godot 4.6.3's
 * `Control` layout math (`scene/gui/control.cpp`): Phase 1 walks the tree
 * bottom-up for combined minimum sizes, Phase 2 walks it top-down assigning
 * rects, free/anchored Controls resolving against their parent's rect (the
 * viewport for roots) and container children resolving through a registered
 * `ContainerLayoutFn` instead. No per-type solver is registered by this
 * module — an unregistered type is a leaf with minimum size `(0, 0)` and, as
 * a container, imposes no layout (its children fall back to the free/anchor
 * path against its own rect).
 *
 * Pure data + functions, no React, no THREE.
*
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { ControlProperties } from '../../../nodes/2d/ui/control/types';
import type { Rect2, Vec2 } from './rect';
import type { SolveNode } from './solveTree';
import type { NativeTheme } from './nativeTheme';
import { controlSolverRegistry, type SolveContext, type TextMeasurer } from './solverRegistry';
import { resolveAnchors } from '../controlAnchors.js';

export interface SolvedControl {
  rect: Rect2;
  minSize: Vec2;
  paintIndex: number;
}

// --- Anchors ---------------------------------------------------------------

/**
 * `Control::_size_changed` (`control.cpp:1760-1771`), the non-RTL branch:
 *
 *     edge_pos[i] = offset[i] + anchor[i] * area;  // area alternates parent w/h
 *     pos = (edge_pos[0], edge_pos[1]);
 *     size = (edge_pos[2], edge_pos[3]) - pos;
 *
 * `parentRect` here is `Control::get_parent_anchorable_rect()`'s SIZE only —
 * its own position never enters the non-RTL formula, and `get_anchorable_rect`
 * (`:1563-1566`) always returns `Rect2(Point2(), size)` for a Control parent,
 * i.e. every rect this solver produces is relative to its immediate parent's
 * top-left, not an absolute viewport position. RTL is out of scope (no
 * `layout_direction` is modelled).
 */
function computeAnchoredRect(p: ControlProperties, parentRect: Rect2): Rect2 {
  const [al, at, ar, ab] = resolveAnchors(p);
  const offsetLeft = p.offsetLeft ?? 0;
  const offsetTop = p.offsetTop ?? 0;
  const offsetRight = p.offsetRight ?? 0;
  const offsetBottom = p.offsetBottom ?? 0;

  const left = offsetLeft + al * parentRect.w;
  const top = offsetTop + at * parentRect.h;
  const right = offsetRight + ar * parentRect.w;
  const bottom = offsetBottom + ab * parentRect.h;

  return { x: left, y: top, w: right - left, h: bottom - top };
}

// --- Minimum-size floor + grow direction ------------------------------------

/** `Control::GrowDirection` (`control.h:59-62`). */
const GROW_DIRECTION_BEGIN = 0;
const GROW_DIRECTION_BOTH = 2;

/**
 * `Control::_size_changed`'s floor (`control.cpp:1773-1797`): when the
 * anchor-derived size is smaller than the combined minimum size, the size is
 * clamped up to the minimum and the position shifts according to the grow
 * direction — `GROW_DIRECTION_END` (the default, `control.h:209-210`) leaves
 * the position alone (the node grows away from its anchor origin, e.g. down
 * and right for a top-left anchor); `BEGIN` shifts backward by the full
 * shortfall; `BOTH` splits the shortfall evenly, growing from the centre.
 */
function floorAtMinimumSize(rect: Rect2, minSize: Vec2, growHorizontal: number, growVertical: number): Rect2 {
  let { x, y, w, h } = rect;

  if (minSize.x > w) {
    if (growHorizontal === GROW_DIRECTION_BEGIN) x += w - minSize.x;
    else if (growHorizontal === GROW_DIRECTION_BOTH) x += 0.5 * (w - minSize.x);
    w = minSize.x;
  }
  if (minSize.y > h) {
    if (growVertical === GROW_DIRECTION_BEGIN) y += h - minSize.y;
    else if (growVertical === GROW_DIRECTION_BOTH) y += 0.5 * (h - minSize.y);
    h = minSize.y;
  }

  return { x, y, w, h };
}

function controlProps(n: SolveNode): ControlProperties {
  return n.node.properties as ControlProperties;
}

// --- Phase 1: combined minimum size ------------------------------------------

/**
 * `Control::get_combined_minimum_size` (`control.cpp:1744-1758`):
 * `max(get_minimum_size(), custom_minimum_size)`. `get_minimum_size()` is the
 * registered type's own contribution (`(0, 0)` for an unregistered/leaf
 * type — this packet registers none).
 */
export function combinedMinimumSize(n: SolveNode, ctx: SolveContext): Vec2 {
  const typeFn = controlSolverRegistry.minimumSize(n.node.type);
  const typeMin = typeFn ? typeFn(n, ctx) : { x: 0, y: 0 };
  const custom = controlProps(n).customMinimumSize ?? { x: 0, y: 0 };
  return { x: Math.max(typeMin.x, custom.x), y: Math.max(typeMin.y, custom.y) };
}

/**
 * Builds a `SolveContext` whose `combinedMinimumSize` is wired back to
 * itself, so a registered `MinimumSizeFn`/`ContainerLayoutFn` recursing into
 * a child through `ctx.combinedMinimumSize` gets the exact same function
 * `solveControlTree`'s own floor step uses.
 *
 * Memoised per node path, which the two-phase walk needs rather than merely
 * benefits from: a container's own minimum size is the aggregate of its
 * children's, so the bottom-up pass already costs one visit per descendant —
 * and then the top-down pass asks each container for its children's minima
 * again. Without the cache a chain of nested containers recomputes each
 * subtree once per ancestor level, which is the common Godot UI shape
 * (Panel → MarginContainer → VBoxContainer → …) and turns a linear walk
 * quadratic. The cache lives on the context, so it spans both phases of one
 * solve and is discarded with it.
 */
export function createSolveContext(
  theme: NativeTheme,
  measureText: TextMeasurer | null = null
): SolveContext {
  const cache = new Map<string, Vec2>();
  const ctx: SolveContext = {
    theme,
    measureText,
    combinedMinimumSize: (n) => {
      const hit = cache.get(n.path);
      if (hit) return hit;
      const value = combinedMinimumSize(n, ctx);
      cache.set(n.path, value);
      return value;
    },
  };
  return ctx;
}

// --- Paint order --------------------------------------------------------------

/** `CanvasItem.z_index` (`scene/main/canvas_item.h:101`), default 0. */
function zIndexOf(n: SolveNode): number {
  return controlProps(n).zIndex ?? 0;
}

/**
 * Pre-order traversal, siblings stably sorted by `z_index` first — Godot's
 * own CanvasItem paint order: a node draws before its children, and children
 * (like the roots passed in) draw in ascending `z_index` order among
 * themselves, ties keeping scene-tree order (`Array.prototype.sort` is
 * stable).
 */
function assignPaintIndex(roots: readonly SolveNode[]): ReadonlyMap<string, number> {
  const order = new Map<string, number>();
  let counter = 0;

  const visit = (nodes: readonly SolveNode[]): void => {
    const sorted = [...nodes].sort((a, b) => zIndexOf(a) - zIndexOf(b));
    for (const node of sorted) {
      order.set(node.path, counter++);
      visit(node.children);
    }
  };

  visit(roots);
  return order;
}

// --- Phase 2: top-down rect assignment ---------------------------------------

function record(
  n: SolveNode,
  rect: Rect2,
  minSize: Vec2,
  paintIndexOf: ReadonlyMap<string, number>,
  out: Map<string, SolvedControl>
): void {
  out.set(n.path, { rect, minSize, paintIndex: paintIndexOf.get(n.path) ?? 0 });
}

/**
 * Solves `n`'s own rect against `parentRect` (the free/anchored path —
 * `Control::_size_changed`), then dispatches its children.
 */
function solveFree(
  n: SolveNode,
  parentRect: Rect2,
  ctx: SolveContext,
  paintIndexOf: ReadonlyMap<string, number>,
  out: Map<string, SolvedControl>
): void {
  const minSize = ctx.combinedMinimumSize(n);
  const props = controlProps(n);
  const raw = computeAnchoredRect(props, parentRect);
  const rect = floorAtMinimumSize(raw, minSize, props.growHorizontal ?? 1, props.growVertical ?? 1);
  record(n, rect, minSize, paintIndexOf, out);
  dispatchChildren(n, rect, ctx, paintIndexOf, out);
}

/**
 * Gives `n`'s children their rects: a registered `ContainerLayoutFn` for
 * `n.node.type` overrides every child's anchors entirely (`Container` owns
 * its children's rects in real Godot too — `layout_mode = 2` children never
 * consult their own anchor/offset properties); absent one, each child solves
 * itself as a free/anchored Control against `n`'s own rect. Either way,
 * grandchildren recurse through the SAME dispatch off the child's resolved
 * rect, so a free Control nested under another free Control (no container
 * anywhere in the chain) resolves against its immediate parent's rect, not
 * the viewport.
 */
function dispatchChildren(
  n: SolveNode,
  rect: Rect2,
  ctx: SolveContext,
  paintIndexOf: ReadonlyMap<string, number>,
  out: Map<string, SolvedControl>
): void {
  const containerFn = controlSolverRegistry.containerLayout(n.node.type);

  if (!containerFn) {
    for (const child of n.children) {
      solveFree(child, rect, ctx, paintIndexOf, out);
    }
    return;
  }

  const childEntries = n.children.map((child) => ({
    node: child,
    minSize: ctx.combinedMinimumSize(child),
  }));
  // No container registers chrome yet; one that does insets its own content
  // rect before calling its ContainerLayoutFn.
  const childRects = containerFn(n, childEntries, rect, ctx);

  for (const { node: child, minSize } of childEntries) {
    const assigned = childRects.get(child.path) ?? { x: 0, y: 0, w: 0, h: 0 };
    // `Container::fit_child_in_rect` ends by calling `Control::set_rect`, so
    // `Control::_size_changed` (control.cpp:1531-1541,1760-1797) re-floors the
    // assigned rect against the child's OWN minimum — full precision, whatever
    // the container's own cell bookkeeping rounded to. `GridContainer` truncates
    // its per-column/row minima to `Size2i`, so a child with a fractional
    // minimum is handed a cell smaller than itself and still renders at its
    // minimum, position shifted per its grow direction.
    //
    // Applied here rather than in each container's port for two reasons: it is
    // `Control`'s behaviour, not any container's, and neither `container.cpp`
    // nor any container's own source file names it — so every port transcribed
    // faithfully from its own source would omit it, and each would be wrong the
    // moment a child's minimum is fractional. Every real text minimum is.
    const childProps = controlProps(child);
    const childRect = floorAtMinimumSize(
      assigned,
      minSize,
      childProps.growHorizontal ?? 1,
      childProps.growVertical ?? 1
    );
    record(child, childRect, minSize, paintIndexOf, out);
    dispatchChildren(child, childRect, ctx, paintIndexOf, out);
  }
}

/**
 * Solves every Control in `roots` (and their descendants) into a rect —
 * Godot pixels, relative to each node's immediate parent (the viewport for a
 * root) — plus its combined minimum size and pre-order paint index.
 */
export function solveControlTree(
  roots: readonly SolveNode[],
  viewport: Rect2,
  ctx: SolveContext
): ReadonlyMap<string, SolvedControl> {
  const out = new Map<string, SolvedControl>();
  const paintIndexOf = assignPaintIndex(roots);

  for (const root of roots) {
    solveFree(root, viewport, ctx, paintIndexOf, out);
  }

  return out;
}
