/**
 * The Control rect solve, a port of Godot 4.6.3's `Control` layout math
 * (`scene/gui/control.cpp`). Phase 1 finds combined minimum sizes bottom-up.
 * Phase 2 assigns rects top-down: free Controls anchor against their parent's rect,
 * and container children take a registered `ContainerLayoutFn`'s. An unregistered
 * type is a leaf of minimum `(0, 0)` that imposes no layout. No React, no THREE.
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
  type SolveContext,
  type TextMeasurer,
} from './solverRegistry';
import type { SealedHandoff } from './solveHandoff';
import { resolveControlLayout, type ControlLayoutOrder } from '../controlAnchors.js';

export interface SolvedControl {
  rect: Rect2;
  minSize: Vec2;
  /**
   * The **solve handoff** this node's `ContainerLayoutFn` sealed for its children,
   * such as a split's dragger position, or `undefined`. Only the producing slice's
   * channel opens it. A `MinimumSizeFn` produces none: what it could hand over is
   * pure in `(n, theme)`, so both sides call a share (`solveHandoff.ts`).
   */
  meta?: SealedHandoff;
}

// --- Anchors ---------------------------------------------------------------

/**
 * `Control::_size_changed`'s anchor arm (`control.cpp:1760-1771`):
 * `edge_pos[i] = offset[i] + anchor[i] * area`. Only `parentRect`'s size enters,
 * since `get_anchorable_rect` (`:1563-1566`) is `Rect2(Point2(), size)`, so every
 * rect is parent-relative. {@link mirrorRectRtl} is the RTL arm, after the floor.
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
 * Resolves `n`'s anchors, offsets and grow direction once (`resolveControlLayout`,
 * ADR-0035), so `presetTimeMinimumSize`, an unmemoised `MinimumSizeFn` run per
 * applied preset or `layout_mode` reset, never runs twice for one node.
 */
function resolveNodeLayout(n: SolveNode, ctx: SolveContext, orderedKeys: ControlLayoutOrder) {
  return resolveControlLayout(controlProps(n), orderedKeys, () => presetTimeMinimumSize(n, ctx));
}

// --- Minimum-size floor + grow direction ------------------------------------

/** `Control::GrowDirection` (`control.h:59-62`). */
const GROW_DIRECTION_BEGIN = 0;
const GROW_DIRECTION_BOTH = 2;

/**
 * `Control::_size_changed`'s floor (`control.cpp:1773-1797`) clamps a size up to
 * the combined minimum. `GROW_DIRECTION_END`, the default (`control.h:209-210`),
 * keeps the position. `BEGIN` shifts back by the whole shortfall, and `BOTH` by half.
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
 * `Control::_size_changed`'s RTL arm (`control.cpp:1785-1787`). The anchorable rect
 * starts at the origin (`control.cpp:1563-1566`), as a root's visible rect does, so
 * only the parent's width appears. It runs after the floor: the height arm between
 * them (`:1775-1797`) touches neither `x` nor `w`.
 */
function mirrorRectRtl(rect: Rect2, parentWidth: number): Rect2 {
  return { ...rect, x: parentWidth - rect.x - rect.w };
}

/**
 * The whole viewport, which a `CanvasLayer` boundary takes wherever it sits: as a
 * `Node`, it leaves a null `data.parent_canvas_item` (`control.cpp:685-711`).
 * `originX` and `originY` are the boundary's parent's absolute top-left, so
 * subtracting them puts the parent-relative rect at the viewport origin.
 */
function canvasBoundaryRect(originX: number, originY: number, viewport: Rect2): Rect2 {
  return { x: viewport.x - originX, y: viewport.y - originY, w: viewport.w, h: viewport.h };
}

/** `CanvasItem::get_anchorable_rect` (`canvas_item.h:414`). Only `Control` overrides it. */
const NON_CONTROL_ANCHORABLE_RECT: Rect2 = { x: 0, y: 0, w: 0, h: 0 };

/**
 * `Control::get_parent_anchorable_rect` (`control.cpp:685-711`) reads the direct
 * parent (`canvas_item.cpp:565-571`), so a node promoted past a non-Control
 * `CanvasItem` anchors against a zero rect. With no `CanvasItem` parent,
 * `parentRect` is already the viewport.
 */
function parentAnchorableRect(n: SolveNode, parentRect: Rect2): Rect2 {
  // `Control::get_anchorable_rect` is `Rect2(Point2(), get_size())`
  // (`control.cpp:1563-1566`); the position never enters the anchor formula.
  return n.skippedAncestors ? NON_CONTROL_ANCHORABLE_RECT : parentRect;
}

// --- Phase 1: combined minimum size ------------------------------------------

/**
 * A `ContainerLayoutFn`'s result, normalised. `'rects' in result`, not
 * `instanceof Map`: TS cannot narrow a `ReadonlyMap` with `instanceof`, and no
 * `Map` has a `rects` own property, so the test is exact.
 */
function normalizeContainerLayoutResult(
  result: ReadonlyMap<string, Rect2> | ContainerLayoutResult
): { rects: ReadonlyMap<string, Rect2>; meta: SealedHandoff | undefined } {
  if ('rects' in result) return { rects: result.rects, meta: result.meta };
  return { rects: result, meta: undefined };
}

/**
 * `Control::get_combined_minimum_size` (`control.cpp:1744-1758`):
 * `max(get_minimum_size(), custom_minimum_size)`. `get_minimum_size()` is the
 * registered type's own contribution (`(0, 0)` for an unregistered/leaf type).
 */
export function combinedMinimumSize(n: SolveNode, ctx: SolveContext): Vec2 {
  const typeFn = controlSolverRegistry.minimumSize(n.node.type);
  const typeMin = typeFn ? typeFn(sortableView(n), ctx) : { x: 0, y: 0 };
  const custom = controlProps(n).customMinimumSize ?? { x: 0, y: 0 };
  return { x: Math.max(typeMin.x, custom.x), y: Math.max(typeMin.y, custom.y) };
}

/**
 * `get_minimum_size()` when `anchors_preset` applies. `SceneState::instantiate`
 * sets properties before parenting (`scene/resources/packed_scene.cpp:492` versus
 * `:541`), `Control`'s first, so the node has no children and only a name. Its
 * theme stays, and `custom_minimum_size` is folded in one level up (`control.cpp:1744-1758`).
 */
function presetTimeMinimumSize(n: SolveNode, ctx: SolveContext): Vec2 {
  const typeFn = controlSolverRegistry.minimumSize(n.node.type);
  if (!typeFn) return { x: 0, y: 0 };
  // Unparsed, so each `MinimumSizeFn` reads `undefined` and falls back to its own
  // `?? default`. A monotone one stays at or below the real minimum, so the floor
  // re-clamps any rect these offsets place.
  const bare: SolveNode = {
    ...n,
    node: { ...n.node, children: [], properties: { name: n.node.name } },
    children: [],
  };
  return typeFn(bare, ctx);
}

/**
 * A `SolveContext` whose `combinedMinimumSize` calls back into itself, so a
 * `MinimumSizeFn` or `ContainerLayoutFn` recursing into a child uses the floor's
 * function. A parameter, not a spread onto the result: the closure would still
 * read the inner `ctx`, which lacks `tentativeRect`.
 */
export function createSolveContext(
  theme: NativeTheme,
  measureText: TextMeasurer | null = null,
  tentativeRect?: (n: SolveNode) => Rect2 | undefined
): SolveContext {
  const cache = new Map<string, Vec2>();
  const ctx: SolveContext = {
    theme,
    measureText,
    // Memoised per path for both phases: without it, nested containers recompute
    // each subtree once per ancestor level, and the walk turns quadratic.
    combinedMinimumSize: (n) => {
      const hit = cache.get(n.path);
      if (hit) return hit;
      const value = combinedMinimumSize(n, ctx);
      cache.set(n.path, value);
      return value;
    },
    tentativeRect,
  };
  return ctx;
}

/**
 * Whether any node's type is registered through `registerSizeDependentMinimum`,
 * which alone makes `solveControlTree` run its second pass.
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
  out: Map<string, SolvedControl>
): void {
  out.set(n.path, { rect, minSize });
}

/**
 * Solves `n`'s own rect against `parentRect` on the free path
 * (`Control::_size_changed`), then dispatches its children.
 */
function solveFree(
  n: SolveNode,
  parentRect: Rect2,
  /** `parentRect`'s top-left in viewport coordinates, for `canvasBoundaryRect`. */
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
    const anchorable = parentAnchorableRect(n, parentRect);
    rect = floorAtMinimumSize(
      computeAnchoredRect(layout.anchors, layout.offsets, anchorable),
      minSize,
      layout.growHorizontal,
      layout.growVertical
    );
    if (n.rtl) rect = mirrorRectRtl(rect, anchorable.w);
  }
  record(n, rect, minSize, out);
  dispatchChildren(n, rect, { x: origin.x + rect.x, y: origin.y + rect.y }, viewport, ctx, out);
}

/**
 * Gives `n`'s children their rects. A registered `ContainerLayoutFn` overrides
 * their anchors, as `layout_mode = 2` children ignore theirs. Otherwise each child
 * solves free against `n`'s rect. Grandchildren recurse off the child's rect.
 */
function dispatchChildren(
  n: SolveNode,
  rect: Rect2,
  /** `n`'s own top-left in viewport coordinates, for `canvasBoundaryRect`. */
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

  // A promoted child is no `get_child(i)` of this Container, so it stays free
  // against the zero rect `parentAnchorableRect` gives it.
  for (const child of n.children.filter(isPromotedControl)) {
    solveFree(child, rect, origin, viewport, ctx, out);
  }

  const childEntries = n.children.filter((child) => !isPromotedControl(child)).map((child) => ({
    node: child,
    minSize: ctx.combinedMinimumSize(child),
  }));
  // No container registers chrome yet; one that does insets its own content
  // rect before calling its ContainerLayoutFn.
  const { rects: childRects, meta: containerMeta } = normalizeContainerLayoutResult(
    containerFn(sortableView(n), childEntries, rect, ctx)
  );

  // The caller has already recorded `n`, so the handoff is patched in.
  if (containerMeta !== undefined) {
    const existing = out.get(n.path);
    if (existing) out.set(n.path, { ...existing, meta: containerMeta });
  }

  for (const { node: child, minSize } of childEntries) {
    const assigned = childRects.get(child.path) ?? { x: 0, y: 0, w: 0, h: 0 };
    // `fit_child_in_rect` ends in `Control::set_rect`, whose `_size_changed`
    // (control.cpp:1531-1541,1760-1797) re-floors at the child's full-precision
    // minimum, whatever a cell rounded to. It lives here, not in each port:
    // `container.cpp` never names it.
    let childRect: Rect2;
    if (controlSolverRegistry.isCanvasBoundary(child.node.type)) {
      childRect = canvasBoundaryRect(origin.x, origin.y, viewport);
    } else {
      const childLayout = resolveNodeLayout(child, ctx, controlLayoutOrder(child));
      // `fit_child_in_rect` ends at `set_rect`, whose `_compute_offsets`
      // un-mirrors the x it was handed (`control.cpp:906-909`) so that the
      // mirror above puts a fitting child straight back. Only a child that
      // outgrows its cell moves, and then its grow direction is mirrored too.
      const unmirrored = child.rtl ? mirrorRectRtl(assigned, rect.w) : assigned;
      const floored = floorAtMinimumSize(unmirrored, minSize, childLayout.growHorizontal, childLayout.growVertical);
      childRect = child.rtl ? mirrorRectRtl(floored, rect.w) : floored;
    }
    record(child, childRect, minSize, out);
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
 * Solves every Control under `roots` into a parent-relative rect in Godot pixels,
 * with its combined minimum size and sealed handoff. A size-dependent type, such
 * as `TextureRect`'s `EXPAND_FIT_WIDTH`, gets one more pass with the first pass's
 * rects as `SolveContext.tentativeRect`.
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

  // One pass, not a loop: the axis a node reads is never downstream of the axis
  // it drives. Godot's `_size_changed`/`update_minimum_size` are reactive too, so
  // a scene that couples them through a container converges in neither.

  const pass2Ctx = createSolveContext(ctx.theme, ctx.measureText, (n) => out.get(n.path)?.rect);
  const out2 = new Map<string, SolvedControl>();
  for (const root of roots) {
    solveFree(root, viewport, rootOrigin, viewport, pass2Ctx, out2);
  }
  return out2;
}
