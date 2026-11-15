/**
 * The y-sort of the canvas item pass: each sort root's flattened subtree, sorted by y and packed
 * into the root's run, as `_cull_canvas_item` sorts a `sort_y` item (`renderer_canvas_cull.cpp:437-469`).
 * Every canvas item type sorts, and both walks read the one result. Pure data: no React, no THREE.
 */

import type { Vector2 } from '../../godot/math/vector';
import {
  multiplyTransform2D,
  transform2DXform,
  TRANSFORM2D_IDENTITY,
  type Transform2DColumns,
} from '../../godot/math/transform2d';
import { parentPathOf } from '../../utils/nodePath';
import { packPaintRanges, type PaintRange } from '../canvasPaintOrder';
import { inSortOrder } from '../ySortOrder';
import type { CanvasItemPassResult } from './canvasItemPass';
import type { CanvasItemPaint } from './canvasItemPaint';

/** The transform in its parent of an item the tree does not place: a solved Control, or a pose a mixer wrote. */
export type SortOrigins = ReadonlyMap<string, Transform2DColumns>;

/** A piece a node draws that the tree does not list, such as a tile row or a ScrollContainer's bar. */
export interface ExtraSortItem {
  readonly id: string;
  /** The point it sorts on, in the space of the node that draws it. */
  readonly origin: Vector2;
  readonly size: number;
  /**
   * Whether Godot collects it after the node's authored children: an `INTERNAL_MODE_BACK` child such
   * as a ScrollContainer's bar (`node.h:585-600`). Every other piece comes before them.
   */
  readonly followsChildren: boolean;
}

/** The extra pieces of each node, by live path, in collection order. */
export type ExtraSortItems = ReadonlyMap<string, readonly ExtraSortItem[]>;

/** The sort y a mixer pose gives an entry now, in the space of the node at live path `space`. */
export interface LiveSortY {
  readonly y: number;
  readonly space: string;
}

/** What the tree does not hold that places a sorted entry. */
export interface SortInputs {
  readonly origins: SortOrigins;
  readonly extras: ExtraSortItems;
  /** The live y of an entry, by live path or extra id, over the y the tree gives. */
  readonly liveYs: ReadonlyMap<string, LiveSortY>;
}

/** What the sort reads of a canvas item: its parent item, whether it is visible, and its fields. */
export interface SortItem {
  readonly parent: string | null;
  readonly isVisible: boolean;
  readonly fields: Pick<CanvasItemPassResult['fields'], 'ySortEnabled' | 'local'>;
}

/** One entry of a sort root's list, before the sort. */
interface SortEntry {
  readonly id: string;
  readonly sortY: number;
  readonly size: number;
}

/**
 * Each sorted entry's run, by live path or by extra id, for every sort root of the tree: the root
 * itself, each item its sort flattens, and their extra pieces. A sorted entry that sorts its own
 * children draws only its body, since those children are entries of their own.
 */
export function ySortedPaint(
  results: ReadonlyMap<string, SortItem>,
  paints: ReadonlyMap<string, CanvasItemPaint>,
  inputs: SortInputs
): ReadonlyMap<string, PaintRange> {
  const runs = new Map<string, PaintRange>();
  const roots = [...results].filter(([, result]) => isSortRoot(result, results));
  if (roots.length === 0) return runs;
  const tree = new SortTree(results, paints, inputs);
  // The results are in tree order, so an outer sort has placed the entry a nested root sits in.
  for (const [path] of roots) {
    const paint = paints.get(path);
    if (!paint) continue;
    const range = movedRange(path, paint.range, runs, paints);
    const sorted = inSortOrder(tree.entriesOf(path), (entry) => entry.sortY);
    const packed = packPaintRanges(
      range,
      sorted.map((entry) => entry.size),
      range.base
    );
    sorted.forEach((entry, index) => runs.set(entry.id, packed[index]!));
  }
  return runs;
}

/**
 * The items that sort their children inside an outer sort, whose children are entries of that sort.
 * Godot culls each entry with the clip of the sort root (`p_canvas_clip`, `renderer_canvas_cull.cpp:458`),
 * so such an item hands its children the clip it took, never a clip of its own.
 */
export function mergedSorters(results: ReadonlyMap<string, SortItem>): ReadonlySet<string> {
  const merged = new Set<string>();
  for (const [path, result] of results) {
    const parent = result.parent === null ? undefined : results.get(result.parent);
    if (result.fields.ySortEnabled && parent?.fields.ySortEnabled) merged.add(path);
  }
  return merged;
}

/** `range` of the node at `path`, moved with the nearest entry above it that a sort has placed. */
function movedRange(
  path: string,
  range: PaintRange,
  runs: ReadonlyMap<string, PaintRange>,
  paints: ReadonlyMap<string, CanvasItemPaint>
): PaintRange {
  const shift = shiftAbove(path, range, runs, paints);
  return shift === 0 ? range : { base: range.base + shift, size: range.size };
}

/**
 * How far the nearest entry above `path` moved: the distance from the run tree order gave it to the
 * run its sort gave. None where that run does not hold `range`, as a canvas root keeps its own.
 */
function shiftAbove(
  path: string,
  range: PaintRange,
  runs: ReadonlyMap<string, PaintRange>,
  paints: ReadonlyMap<string, CanvasItemPaint>
): number {
  for (let above = parentPathOf(path); above !== null; above = parentPathOf(above)) {
    const run = runs.get(above);
    if (!run) continue;
    const moved = paints.get(above)?.range;
    return moved && isInside(range, moved) ? run.base - moved.base : 0;
  }
  return 0;
}

/** A `sort_y` item that no outer sort flattens: its parent item does not sort, or it has none. */
function isSortRoot(result: SortItem, results: ReadonlyMap<string, SortItem>): boolean {
  if (!result.fields.ySortEnabled || !result.isVisible) return false;
  const parent = result.parent === null ? undefined : results.get(result.parent);
  return !parent?.fields.ySortEnabled;
}

/** The pass's results read as Godot's `child_items` lists. */
class SortTree {
  private readonly childItems = new Map<string, string[]>();
  private readonly childNodes = new Map<string, string[]>();
  /** Written only by `collect`: each collected node's transform in the space of the root being collected. */
  private readonly toRootOf = new Map<string, Transform2DColumns>();

  constructor(
    private readonly results: ReadonlyMap<string, SortItem>,
    private readonly paints: ReadonlyMap<string, CanvasItemPaint>,
    private readonly inputs: SortInputs
  ) {
    for (const [path, result] of results) {
      if (result.parent !== null) listUnder(this.childItems, result.parent, path);
    }
    for (const path of paints.keys()) {
      const parent = parentPathOf(path);
      if (parent !== null) listUnder(this.childNodes, parent, path);
    }
  }

  /** The root as entry 0 at an identity transform, then its flattened subtree (`renderer_canvas_cull.cpp:446-452`). */
  entriesOf(root: string): SortEntry[] {
    const entries: SortEntry[] = [{ id: root, sortY: 0, size: this.bodySize(root) }];
    this.toRootOf.clear();
    this.collect(root, TRANSFORM2D_IDENTITY, entries);
    return entries;
  }

  /**
   * `_collect_ysort_children` (`renderer_canvas_cull.cpp:110-160`): the node's extra pieces, its
   * authored children, then its internal back pieces.
   */
  private collect(path: string, toRoot: Transform2DColumns, entries: SortEntry[]): void {
    this.toRootOf.set(path, toRoot);
    const extras = this.inputs.extras.get(path) ?? [];
    this.collectExtras(
      extras.filter((extra) => !extra.followsChildren),
      toRoot,
      entries
    );
    this.collectChildren(path, toRoot, entries);
    this.collectExtras(
      extras.filter((extra) => extra.followsChildren),
      toRoot,
      entries
    );
  }

  /** The y of `id` in the root's space: its live y where a pose gives one, else `placed`. */
  private sortYOf(id: string, placed: number): number {
    const live = this.inputs.liveYs.get(id);
    const toRoot = live && this.toRootOf.get(live.space);
    return toRoot ? transform2DXform(toRoot, { x: 0, y: live.y }).y : placed;
  }

  private collectExtras(
    extras: readonly ExtraSortItem[],
    toRoot: Transform2DColumns,
    entries: SortEntry[]
  ): void {
    for (const extra of extras) {
      const sortY = this.sortYOf(extra.id, transform2DXform(toRoot, extra.origin).y);
      entries.push({ id: extra.id, sortY, size: extra.size });
    }
  }

  private collectChildren(path: string, toRoot: Transform2DColumns, entries: SortEntry[]): void {
    for (const child of this.childItems.get(path) ?? []) {
      const result = this.results.get(child)!;
      if (!result.isVisible) continue;
      const xform = multiplyTransform2D(toRoot, this.localOf(child, result));
      const sortsChildren = result.fields.ySortEnabled;
      const size = sortsChildren ? this.bodySize(child) : (this.paints.get(child)?.range.size ?? 0);
      entries.push({ id: child, sortY: this.sortYOf(child, xform.ty), size });
      if (sortsChildren) this.collect(child, xform, entries);
    }
  }

  private localOf(path: string, result: SortItem): Transform2DColumns {
    return this.inputs.origins.get(path) ?? result.fields.local ?? TRANSFORM2D_IDENTITY;
  }

  /**
   * The values an item draws itself, without the runs its child nodes own and its extra pieces
   * take. The pieces draw from the room the item reserves, and the body keeps at least one value.
   */
  private bodySize(path: string): number {
    const range = this.paints.get(path)?.range.size ?? 0;
    const children = this.childNodes.get(path) ?? [];
    const childSizes = children.reduce((sum, child) => sum + (this.paints.get(child)?.range.size ?? 0), 0);
    const extraSizes = (this.inputs.extras.get(path) ?? []).reduce((sum, extra) => sum + extra.size, 0);
    return Math.max(1, range - childSizes - extraSizes);
  }
}

/**
 * The paint of the node at `path` after the sorts: moved into its own entry's run, or into the run of
 * the entry its subtree draws in. An entry that sorts its own children keeps only its body's pieces,
 * closed up where its children's runs were. A canvas root below an entry keeps its run.
 */
export function sortedPaintOf(
  path: string,
  paint: CanvasItemPaint,
  runs: ReadonlyMap<string, PaintRange>,
  paints: ReadonlyMap<string, CanvasItemPaint>
): CanvasItemPaint {
  if (runs.size === 0) return paint;
  const own = runs.get(path);
  if (own)
    return own.size === paint.range.size ? shifted(paint, own.base - paint.range.base) : bodyAt(paint, own);
  return shifted(paint, shiftAbove(path, paint.range, runs, paints));
}

/**
 * The body pieces of `paint` packed into `run`: the pieces after its children move up by their runs.
 * The front room holds the runs of internal front children, which are entries of their own, so the
 * children start at the front room and the body keeps none of it.
 */
function bodyAt(paint: CanvasItemPaint, run: PaintRange): CanvasItemPaint {
  const shift = run.base - paint.range.base;
  const childrenStart = paint.front.base;
  const childrenSize = paint.range.size - run.size;
  // The pieces that take runs of their own leave their room too, so a value past them stays in the run.
  const last = run.base + run.size - 1;
  const at = (value: number): number =>
    Math.max(run.base, Math.min(last, value + shift - (value >= childrenStart ? childrenSize : 0)));
  const move = (range: PaintRange): PaintRange => {
    const base = at(range.base);
    return { base, size: Math.min(range.size, run.base + run.size - base) };
  };
  return {
    range: run,
    own: at(paint.own),
    front: { base: at(paint.front.base), size: 0 },
    layer: at(paint.layer),
    back: move(paint.back),
    tail: move(paint.tail),
    behind: [],
  };
}

function shifted(paint: CanvasItemPaint, shift: number): CanvasItemPaint {
  if (shift === 0) return paint;
  const move = (range: PaintRange): PaintRange => ({ base: range.base + shift, size: range.size });
  return {
    range: move(paint.range),
    own: paint.own + shift,
    front: move(paint.front),
    layer: paint.layer + shift,
    back: move(paint.back),
    tail: move(paint.tail),
    behind: paint.behind.map(move),
  };
}

function isInside(range: PaintRange, outer: PaintRange): boolean {
  return range.base >= outer.base && range.base + range.size <= outer.base + outer.size;
}

function listUnder(lists: Map<string, string[]>, parent: string, path: string): void {
  const list = lists.get(parent);
  if (list) list.push(path);
  else lists.set(parent, [path]);
}
