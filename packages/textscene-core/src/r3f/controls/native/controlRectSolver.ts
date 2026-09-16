/**
 * The Control rect solve. Pure TS port of Godot 4.6.3's
 * `Control` layout math (`scene/gui/control.cpp`): Phase 1 walks the tree
 * bottom-up for combined minimum sizes, Phase 2 walks it top-down assigning
 * rects, free/anchored Controls resolving against their parent's rect (the
 * viewport for roots, a zero rect for one promoted past a non-Control
 * CanvasItem — `parentAnchorableRect`) and container children resolving through
 * a registered
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

import type { Rect2, Vec2 } from './rect';
import { controlLayoutOrder, controlProps, isPromotedControl, sortableView, type SolveNode } from './solveTree';
import type { NativeTheme } from './nativeTheme';
import {
  controlSolverRegistry,
  type ContainerLayoutResult,
  type MinimumSizeResult,
  type SolveContext,
  type TextMeasurer,
} from './solverRegistry';
import { resolveControlLayout, type ControlLayoutOrder } from '../controlAnchors.js';

export interface SolvedControl {
  rect: Rect2;
  minSize: Vec2;
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
function computeAnchoredRect(anchors: [number, number, number, number], offsets: [number, number, number, number], parentRect: Rect2): Rect2 {
  const [al, at, ar, ab] = anchors;
  const [offsetLeft, offsetTop, offsetRight, offsetBottom] = offsets;

  const left = offsetLeft + al * parentRect.w;
  const top = offsetTop + at * parentRect.h;
  const right = offsetRight + ar * parentRect.w;
  const bottom = offsetBottom + ab * parentRect.h;

  return { x: left, y: top, w: right - left, h: bottom - top };
}

/**
 * Resolves `n`'s anchors/offsets/grow-direction ONCE (`resolveControlLayout`,
 * `controlAnchors.ts`, ADR-0035) — `solveFree` needs anchors+offsets for its
 * own rect and grow-direction for the floor step right after; `dispatchChildren`
 * needs only grow-direction for a container child's re-floor. One resolve per
 * node keeps `presetTimeMinimumSize` (an unmemoised `MinimumSizeFn` run, fired
 * once per applied preset or `layout_mode` reset — the orphan `size_cache`
 * KEEP_SIZE reads is floored at it) from firing twice for the SAME node the
 * way two separate resolver calls would.
 */
function resolveNodeLayout(n: SolveNode, ctx: SolveContext, orderedKeys: ControlLayoutOrder) {
  return resolveControlLayout(controlProps(n), orderedKeys, () => presetTimeMinimumSize(n, ctx));
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

/**
 * The rect a registered canvas boundary (`controlSolverRegistry.isCanvasBoundary`
 * — `CanvasLayer`) takes: the whole VIEWPORT, wherever in the tree it sits.
 *
 * Such a node is a `Node`, not a `CanvasItem`, so a Control beneath it has a
 * null `data.parent_canvas_item` and `Control::get_parent_anchorable_rect`
 * (`control.cpp:685-711`) answers with `get_viewport()->get_visible_rect()` —
 * the same null that resets modulate to white and the sampler to the root
 * default. A full-screen HUD under an offset 200x100 Panel therefore covers the
 * SCREEN, not the panel.
 *
 * The boundary authors no anchors or offsets of its own, so the anchor formula
 * would hand it `(0, 0, 0, 0)` and every Control beneath it would anchor against
 * a degenerate rect. Stating the viewport instead is what makes the passthrough
 * faithful; `originX`/`originY` are the boundary's parent's absolute top-left,
 * and subtracting them is what puts a rect that is expressed relative to that
 * parent back at the viewport origin.
 */
function canvasBoundaryRect(originX: number, originY: number, viewport: Rect2): Rect2 {
  return { x: viewport.x - originX, y: viewport.y - originY, w: viewport.w, h: viewport.h };
}

/** `CanvasItem::get_anchorable_rect` (`canvas_item.h:414`) — only `Control` overrides it. */
const NON_CONTROL_ANCHORABLE_RECT: Rect2 = { x: 0, y: 0, w: 0, h: 0 };

/**
 * `Control::get_parent_anchorable_rect` (`control.cpp:685-711`), which reads
 * `data.parent_canvas_item` — `get_parent_item()`'s cast of the DIRECT parent
 * (`canvas_item.cpp:565-571`), never a climbed ancestor.
 *
 * A node the walker promoted past a non-Control `CanvasItem` therefore anchors
 * against `Rect2(0, 0, 0, 0)` and is placed by its offsets alone, not against
 * the Control it was promoted to. The third case — no `CanvasItem` parent at
 * all — needs no branch: such a node is a solve-tree root (or a canvas
 * boundary's child), and `parentRect` is already the viewport there.
 */
function parentAnchorableRect(n: SolveNode, parentRect: Rect2): Rect2 {
  // `Control::get_anchorable_rect` is `Rect2(Point2(), get_size())`
  // (`control.cpp:1563-1566`); the position never enters the anchor formula.
  return n.skippedAncestors ? NON_CONTROL_ANCHORABLE_RECT : parentRect;
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
  const raw = typeFn ? typeFn(sortableView(n), ctx) : { x: 0, y: 0 };
  const { size: typeMin, meta } = normalizeMinimumSizeResult(raw);
  const custom = controlProps(n).customMinimumSize ?? { x: 0, y: 0 };
  return { size: { x: Math.max(typeMin.x, custom.x), y: Math.max(typeMin.y, custom.y) }, meta };
}

/**
 * `Control::get_combined_minimum_size` (`control.cpp:1744-1758`):
 * `max(get_minimum_size(), custom_minimum_size)`. `get_minimum_size()` is the
 * registered type's own contribution (`(0, 0)` for an unregistered/leaf type).
 */
export function combinedMinimumSize(n: SolveNode, ctx: SolveContext): Vec2 {
  return combinedMinimumSizeWithMeta(n, ctx).size;
}

/**
 * `Control::get_minimum_size()` as it reads at the instant `anchors_preset` is
 * applied — the one input `resolveOffsets` needs that is not a property of the
 * node.
 *
 * Two things separate it from `combinedMinimumSize`, both because
 * `SceneState::instantiate` sets a node's properties before it is ever added
 * to a parent (`scene/resources/packed_scene.cpp:492` vs `:541`) and walks
 * them in the order the scene lists them, `Control`'s ahead of any subclass's:
 * the node has NO children yet, and none of its own type's properties are set.
 * So the registered `MinimumSizeFn` runs against a childless node carrying
 * only a name — an empty Label, a text-less Button — and
 * `custom_minimum_size`, which `get_minimum_size()` excludes anyway
 * (`control.cpp:1744-1758` folds it in one level up), never enters.
 *
 * Theme resources stay: a Control's theme comes from its class's default,
 * which the orphan already has.
 *
 * The bag handed to the `MinimumSizeFn` is SYNTHETIC and never went through a
 * slice's `parser.ts`, so it carries none of Godot's parsed property defaults
 * — `stretchMode`, `expandMode`, `stretch` and their kin read `undefined`
 * here where every other caller sees a parsed value, and each function's own
 * `?? default` fallbacks are what stand in. That is sound only because of the
 * bound below; a `MinimumSizeFn` that read a property WITHOUT a fallback
 * would see `undefined` at preset time alone.
 *
 * The result is bounded above by the node's real combined minimum for every
 * monotone `MinimumSizeFn` — stripping content cannot enlarge a minimum — so
 * the offsets this feeds can only ever place a rect the min-size floor then
 * re-clamps, never one that overshoots it.
 */
function presetTimeMinimumSize(n: SolveNode, ctx: SolveContext): Vec2 {
  const typeFn = controlSolverRegistry.minimumSize(n.node.type);
  if (!typeFn) return { x: 0, y: 0 };
  const bare: SolveNode = {
    ...n,
    node: { ...n.node, children: [], properties: { name: n.node.name } },
    children: [],
  };
  return normalizeMinimumSizeResult(typeFn(bare, ctx)).size;
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

/**
 * Whether any node in the tree is a type registered via
 * `controlSolverRegistry.registerSizeDependentMinimum`, which decides whether
 * `solveControlTree` runs its bounded second pass at all (see
 * `SolveContext.tentativeRect`'s own doc). Skipping the pass entirely for the
 * overwhelmingly common tree with no such type keeps a plain single-pass solve
 * exactly as cheap as it was before that pass existed.
 *
 * This used to ride a pre-order walk that also numbered every node for paint
 * order. Draw order is no longer the solver's business — a Control takes the
 * same canvas key as every other CanvasItem, from the draw sequence
 * `buildSolveTree` allocates over its LIVE siblings (`canvasPaintOrder.ts`) —
 * so what is left is this one question.
 */
function hasSizeDependentMinimum(roots: readonly SolveNode[]): boolean {
  for (const node of roots) {
    if (controlSolverRegistry.isSizeDependentMinimum(node.node.type)) return true;
    if (hasSizeDependentMinimum(node.children)) return true;
  }
  return false;
}

// --- Phase 2: top-down rect assignment ---------------------------------------

function record(
  n: SolveNode,
  rect: Rect2,
  minSize: Vec2,
  out: Map<string, SolvedControl>,
  meta?: unknown
): void {
  out.set(n.path, {
    rect,
    minSize,
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
  /** `parentRect`'s top-left in VIEWPORT coordinates — see `canvasBoundaryRect`. */
  origin: Vec2,
  viewport: Rect2,
  ctx: SolveContext,
  out: Map<string, SolvedControl>
): void {
  const minSize = ctx.combinedMinimumSize(n);
  let rect: Rect2;
  if (controlSolverRegistry.isCanvasBoundary(n.node.type)) {
    rect = canvasBoundaryRect(origin.x, origin.y, viewport);
  } else {
    const layout = resolveNodeLayout(n, ctx, controlLayoutOrder(n));
    rect = floorAtMinimumSize(
      computeAnchoredRect(layout.anchors, layout.offsets, parentAnchorableRect(n, parentRect)),
      minSize,
      layout.growHorizontal,
      layout.growVertical
    );
  }
  record(n, rect, minSize, out, ctx.minimumSizeMeta?.(n));
  dispatchChildren(n, rect, { x: origin.x + rect.x, y: origin.y + rect.y }, viewport, ctx, out);
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
  /** `n`'s own top-left in VIEWPORT coordinates — see `canvasBoundaryRect`. */
  origin: Vec2,
  viewport: Rect2,
  ctx: SolveContext,
  out: Map<string, SolvedControl>
): void {
  const containerFn = controlSolverRegistry.containerLayout(n.node.type);

  if (!containerFn) {
    for (const child of n.children) {
      solveFree(child, rect, origin, viewport, ctx, out);
    }
    return;
  }

  // A promoted child is not one of this Container's `get_child(i)`, so no
  // arrangement pass ever reaches it (`isPromotedControl`) — it stays free and
  // keeps its own anchors, against the zero rect `parentAnchorableRect` gives it.
  for (const child of n.children.filter(isPromotedControl)) {
    solveFree(child, rect, origin, viewport, ctx, out);
  }

  const childEntries = n.children.filter((child) => !isPromotedControl(child)).map((child) => ({
    node: child,
    minSize: ctx.combinedMinimumSize(child),
    meta: ctx.minimumSizeMeta?.(child),
  }));
  // No container registers chrome yet; one that does insets its own content
  // rect before calling its ContainerLayoutFn.
  const { rects: childRects, meta: containerMeta } = normalizeContainerLayoutResult(
    containerFn(sortableView(n), childEntries, rect, ctx)
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
    let childRect: Rect2;
    if (controlSolverRegistry.isCanvasBoundary(child.node.type)) {
      childRect = canvasBoundaryRect(origin.x, origin.y, viewport);
    } else {
      const childLayout = resolveNodeLayout(child, ctx, controlLayoutOrder(child));
      childRect = floorAtMinimumSize(assigned, minSize, childLayout.growHorizontal, childLayout.growVertical);
    }
    record(child, childRect, minSize, out, meta);
    dispatchChildren(
      child,
      childRect,
      { x: origin.x + childRect.x, y: origin.y + childRect.y },
      viewport,
      ctx,
      out
    );
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
 * membership check `hasSizeDependentMinimum` already performed.
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
  // A root's rect is stated relative to the viewport, so the viewport's own
  // top-left is where the absolute walk starts.
  const rootOrigin: Vec2 = { x: viewport.x, y: viewport.y };
  const out = new Map<string, SolvedControl>();
  for (const root of roots) {
    solveFree(root, viewport, rootOrigin, viewport, ctx, out);
  }

  if (!hasSizeDependentMinimum(roots)) return out;

  const pass2Ctx = createSolveContext(ctx.theme, ctx.measureText, (n) => out.get(n.path)?.rect);
  const out2 = new Map<string, SolvedControl>();
  for (const root of roots) {
    solveFree(root, viewport, rootOrigin, viewport, pass2Ctx, out2);
  }
  return out2;
}
