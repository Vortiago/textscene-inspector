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
import {
  controlSolverRegistry,
  type ContainerLayoutResult,
  type MinimumSizeResult,
  type SolveContext,
  type TextMeasurer,
} from './solverRegistry';
import { resolveAnchors } from '../controlAnchors.js';

export interface SolvedControl {
  rect: Rect2;
  minSize: Vec2;
  paintIndex: number;
  /**
   * The paint index of the LAST node visited within this node's own
   * subtree (pre-order, siblings pre-sorted by `z_index` — same walk as
   * `paintIndex`) — its own index when it is a leaf. A plain pre-order fact,
   * not a second traversal: `assignPaintIndex` already has this number in
   * hand as `counter - 1` right after recursing into a node's children.
   *
   * Exists so chrome that must draw AFTER an entire subtree — Godot's
   * `INTERNAL_MODE_BACK` children, e.g. `ScrollContainer`'s `h_scroll`/
   * `v_scroll` (`scene/gui/scroll_container.cpp:919,924`) — can derive a
   * render order from it instead of the node's own `paintIndex`, which every
   * descendant necessarily exceeds. See `native/controlDrawOrder.ts`'s
   * `controlRenderOrder` and `ControlComponentRegistry.ts`'s
   * `NativeControlComponentProps.subtreeChromeRenderOrder`.
   */
  subtreeLastPaintIndex: number;
  /**
   * This node's own intermediate, if its registered `MinimumSizeFn`/
   * `ContainerLayoutFn` attached one (`MinimumSizeResult.meta` /
   * `ContainerLayoutResult.meta` — see either's own doc). A
   * `ContainerLayoutFn`'s meta describes what THIS node computed while
   * laying out its CHILDREN (a split's dragger position, a scroll
   * container's bar geometry) and wins over a `MinimumSizeFn`'s meta for the
   * SAME node when both are present — no registered type needs both today
   * (a container's painter cares about its own layout output, not its
   * floor-computation intermediate), so one slot is enough; a type that
   * genuinely needed both would be the first to widen this.
   *
   * `unknown` at this boundary since its shape is entirely the producing
   * type's own — `NativeControlComponentProps.meta` is the same value, and a
   * painter casts it exactly like it already casts
   * `solveNode.node.properties`.
   */
  meta?: unknown;
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

/**
 * The rect a registered canvas boundary (`controlSolverRegistry.isCanvasBoundary`
 * — `CanvasLayer`) takes: the whole rect it was handed, at its origin.
 *
 * Such a node is not a `CanvasItem`, so `Control::get_parent_anchorable_rect`
 * (`control.cpp:1568-1578`) never consults it — a Control under one resolves
 * against the viewport instead. It also authors no anchors or offsets, so the
 * anchor formula would hand it `(0, 0, 0, 0)` and every Control beneath it would
 * anchor against a degenerate rect: a `FULL_RECT` HUD collapses to nothing, and a
 * right-anchored one lands at negative x. Filling the rect it was given makes
 * this boundary a pure passthrough — it authors no rect of its own, so it
 * takes on its parent's exactly.
 */
function canvasBoundaryRect(parentRect: Rect2): Rect2 {
  return { x: 0, y: 0, w: parentRect.w, h: parentRect.h };
}

// --- Phase 1: combined minimum size ------------------------------------------

/** A `MinimumSizeFn`'s normalised result — see `MinimumSizeResult`'s own doc for why a bare `Vec2` and this shape both need to be accepted. A `MinimumSizeResult` never carries an `x`/`y` of its own, so `'size' in result` cleanly tells the two apart. */
function normalizeMinimumSizeResult(result: Vec2 | MinimumSizeResult): { size: Vec2; meta: unknown } {
  if ('size' in result) return { size: result.size, meta: result.meta };
  return { size: result, meta: undefined };
}

/**
 * A `ContainerLayoutFn`'s normalised result — see `ContainerLayoutResult`'s
 * own doc. `'rects' in result` rather than `result instanceof Map`: a plain
 * `Map` is not STRUCTURALLY a subtype of `Map<any, any>` from TS's own
 * narrowing rules once its declared type is the read-only `ReadonlyMap`
 * interface (it lacks `set`/`delete`/`clear` in that view), so `instanceof`
 * cannot safely exclude it from the other arm of the union — a real `Map`
 * never carries a `rects` OWN property either way, so this discriminator is
 * exact, not a heuristic.
 */
function normalizeContainerLayoutResult(
  result: ReadonlyMap<string, Rect2> | ContainerLayoutResult
): { rects: ReadonlyMap<string, Rect2>; meta: unknown } {
  if ('rects' in result) return { rects: result.rects, meta: result.meta };
  return { rects: result, meta: undefined };
}

/**
 * `Control::get_combined_minimum_size` (`control.cpp:1744-1758`) PLUS this
 * type's own meta, if its registered `MinimumSizeFn` attached one — the
 * pairing `createSolveContext`'s cache actually stores; `combinedMinimumSize`
 * below returns only the `Vec2` half, unchanged from before `meta` existed.
 */
function combinedMinimumSizeWithMeta(n: SolveNode, ctx: SolveContext): { size: Vec2; meta: unknown } {
  const typeFn = controlSolverRegistry.minimumSize(n.node.type);
  const raw = typeFn ? typeFn(n, ctx) : { x: 0, y: 0 };
  const { size: typeMin, meta } = normalizeMinimumSizeResult(raw);
  const custom = controlProps(n).customMinimumSize ?? { x: 0, y: 0 };
  return { size: { x: Math.max(typeMin.x, custom.x), y: Math.max(typeMin.y, custom.y) }, meta };
}

/**
 * `Control::get_combined_minimum_size` (`control.cpp:1744-1758`):
 * `max(get_minimum_size(), custom_minimum_size)`. `get_minimum_size()` is the
 * registered type's own contribution (`(0, 0)` for an unregistered/leaf
 * type — this packet registers none).
 */
export function combinedMinimumSize(n: SolveNode, ctx: SolveContext): Vec2 {
  return combinedMinimumSizeWithMeta(n, ctx).size;
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
 *
 * The SAME cache backs `minimumSizeMeta`: both read the ONE
 * `combinedMinimumSizeWithMeta` call per path, so asking for a node's meta
 * after (or before) its size costs nothing beyond the lookup already paid
 * for by the memoisation above.
 *
 * `tentativeRect`, when given, becomes this context's own — `solveFree`'s
 * (transitively, `combinedMinimumSizeWithMeta`'s) reference to `ctx` inside
 * this closure must resolve to the object this field actually lives on, so
 * `solveControlTree`'s own second pass cannot build one via `{
 * ...createSolveContext(...), tentativeRect }`: that spread would copy the
 * `combinedMinimumSize`/`minimumSizeMeta` CLOSURES from the ORIGINAL object,
 * which still call back into an inner `ctx` that never gained the field.
 */
export function createSolveContext(
  theme: NativeTheme,
  measureText: TextMeasurer | null = null,
  tentativeRect?: (n: SolveNode) => Rect2 | undefined
): SolveContext {
  const cache = new Map<string, { size: Vec2; meta: unknown }>();
  const resolve = (n: SolveNode): { size: Vec2; meta: unknown } => {
    const hit = cache.get(n.path);
    if (hit) return hit;
    const value = combinedMinimumSizeWithMeta(n, ctx);
    cache.set(n.path, value);
    return value;
  };
  const ctx: SolveContext = {
    theme,
    measureText,
    combinedMinimumSize: (n) => resolve(n).size,
    minimumSizeMeta: (n) => resolve(n).meta,
    tentativeRect,
  };
  return ctx;
}

// --- Paint order --------------------------------------------------------------

/** `CanvasItem.z_index` (`scene/main/canvas_item.h:101`), default 0. */
function zIndexOf(n: SolveNode): number {
  return controlProps(n).zIndex ?? 0;
}

/** `assignPaintIndex`'s parallel outputs — one pre-order walk, several facts about the whole tree. */
interface PaintIndexResult {
  order: ReadonlyMap<string, number>;
  subtreeLast: ReadonlyMap<string, number>;
  /**
   * Whether ANY node in this tree is a type registered via
   * `controlSolverRegistry.registerSizeDependentMinimum` — decides whether
   * `solveControlTree` runs its bounded second pass at all (see
   * `SolveContext.tentativeRect`'s own doc). Computed during this SAME
   * pre-order walk rather than a separate scan: every solve already pays for
   * this traversal, so piggybacking the check costs nothing extra, and
   * skipping it entirely for the (overwhelmingly common) tree with no such
   * type keeps a plain single-pass solve exactly as cheap as before this
   * existed.
   */
  hasSizeDependentMinimum: boolean;
}

/**
 * Pre-order traversal, siblings stably sorted by `z_index` first — Godot's
 * own CanvasItem paint order: a node draws before its children, and children
 * (like the roots passed in) draw in ascending `z_index` order among
 * themselves, ties keeping scene-tree order (`Array.prototype.sort` is
 * stable).
 *
 * Also records each node's `subtreeLast` — the paint index of the last node
 * visited within its own subtree — as `counter - 1` right after recursing
 * into its children, so this stays the one traversal rather than a second
 * pass over the same tree.
 */
function assignPaintIndex(roots: readonly SolveNode[]): PaintIndexResult {
  const order = new Map<string, number>();
  const subtreeLast = new Map<string, number>();
  let counter = 0;
  let hasSizeDependentMinimum = false;

  const visit = (nodes: readonly SolveNode[]): void => {
    const sorted = [...nodes].sort((a, b) => zIndexOf(a) - zIndexOf(b));
    for (const node of sorted) {
      if (controlSolverRegistry.isSizeDependentMinimum(node.node.type)) hasSizeDependentMinimum = true;
      order.set(node.path, counter++);
      visit(node.children);
      subtreeLast.set(node.path, counter - 1);
    }
  };

  visit(roots);
  return { order, subtreeLast, hasSizeDependentMinimum };
}

// --- Phase 2: top-down rect assignment ---------------------------------------

function record(
  n: SolveNode,
  rect: Rect2,
  minSize: Vec2,
  paintIndex: PaintIndexResult,
  out: Map<string, SolvedControl>,
  meta?: unknown
): void {
  out.set(n.path, {
    rect,
    minSize,
    paintIndex: paintIndex.order.get(n.path) ?? 0,
    subtreeLastPaintIndex: paintIndex.subtreeLast.get(n.path) ?? 0,
    meta,
  });
}

/**
 * Solves `n`'s own rect against `parentRect` (the free/anchored path —
 * `Control::_size_changed`), then dispatches its children.
 */
function solveFree(
  n: SolveNode,
  parentRect: Rect2,
  ctx: SolveContext,
  paintIndexOf: PaintIndexResult,
  out: Map<string, SolvedControl>
): void {
  const minSize = ctx.combinedMinimumSize(n);
  const props = controlProps(n);
  const rect = controlSolverRegistry.isCanvasBoundary(n.node.type)
    ? canvasBoundaryRect(parentRect)
    : floorAtMinimumSize(
        computeAnchoredRect(props, parentRect),
        minSize,
        props.growHorizontal ?? 1,
        props.growVertical ?? 1
      );
  record(n, rect, minSize, paintIndexOf, out, ctx.minimumSizeMeta?.(n));
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
  paintIndexOf: PaintIndexResult,
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
    meta: ctx.minimumSizeMeta?.(child),
  }));
  // No container registers chrome yet; one that does insets its own content
  // rect before calling its ContainerLayoutFn.
  const { rects: childRects, meta: containerMeta } = normalizeContainerLayoutResult(
    containerFn(n, childEntries, rect, ctx)
  );

  // `n`'s own record already happened in the caller (`solveFree`, or this
  // same function one level up for a non-root container) BEFORE this
  // function ran — patch its meta in now that the container layout that
  // just ran has computed one. Wins over any `MinimumSizeFn`-sourced meta
  // already on the entry (see `SolvedControl.meta`'s own doc for why that
  // never collides with a real type today).
  if (containerMeta !== undefined) {
    const existing = out.get(n.path);
    if (existing) out.set(n.path, { ...existing, meta: containerMeta });
  }

  for (const { node: child, minSize, meta } of childEntries) {
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
    const childRect = controlSolverRegistry.isCanvasBoundary(child.node.type)
      ? canvasBoundaryRect(rect)
      : floorAtMinimumSize(assigned, minSize, childProps.growHorizontal ?? 1, childProps.growVertical ?? 1);
    record(child, childRect, minSize, paintIndexOf, out, meta);
    dispatchChildren(child, childRect, ctx, paintIndexOf, out);
  }
}

/**
 * Solves every Control in `roots` (and their descendants) into a rect —
 * Godot pixels, relative to each node's immediate parent (the viewport for a
 * root) — plus its combined minimum size and pre-order paint index.
 *
 * Runs a SECOND, final pass — feeding the first pass's own resolved rects
 * back in as `SolveContext.tentativeRect` — when (and only when) `roots`
 * contains a type registered via `registerSizeDependentMinimum` (see that
 * field's own doc for why one such type, `TextureRect`'s `EXPAND_FIT_WIDTH`/
 * `FIT_HEIGHT`, exists at all). Every OTHER `MinimumSizeFn`/`ContainerLayoutFn`
 * is a pure function of props + the rest of `ctx`, neither of which changes
 * between passes, so its output does not either — the second pass changes
 * ONLY the rects (and anything downstream of them, e.g. an ancestor
 * container's own size) that a size-dependent type's corrected minimum
 * actually touches. A tree with no such type pays nothing beyond the
 * membership check `assignPaintIndex` already performed.
 *
 * Bounded at exactly one extra pass, not a loop to convergence: the ONE
 * self-reference this codebase models (a control's OWN size feeding its OWN
 * minimum, on the axis IT does not drive) is resolved after a single
 * correction, since the axis it reads is never itself downstream of the
 * axis it drives. A pathological scene that made the two mutually dependent
 * through a container's own cross-axis negotiation would not fully converge
 * even in real, live Godot (`_size_changed`/`update_minimum_size` are
 * likewise reactive, not iterative-to-convergence) — this matches that same
 * practical guarantee rather than a stronger one this codebase's clean
 * two-phase solve cannot make deterministic anyway.
 */
export function solveControlTree(
  roots: readonly SolveNode[],
  viewport: Rect2,
  ctx: SolveContext
): ReadonlyMap<string, SolvedControl> {
  const paintIndexOf = assignPaintIndex(roots);

  const out = new Map<string, SolvedControl>();
  for (const root of roots) {
    solveFree(root, viewport, ctx, paintIndexOf, out);
  }

  if (!paintIndexOf.hasSizeDependentMinimum) return out;

  const pass2Ctx = createSolveContext(ctx.theme, ctx.measureText, (n) => out.get(n.path)?.rect);
  const out2 = new Map<string, SolvedControl>();
  for (const root of roots) {
    solveFree(root, viewport, pass2Ctx, paintIndexOf, out2);
  }
  return out2;
}
