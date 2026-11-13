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
import { compareSortY } from '../ySortOrder';
import type { CanvasItemPassResult } from './canvasItemPass';
import type { CanvasItemPaint } from './canvasItemPaint';

/** The transform in its parent of an item the tree does not place: a solved Control, or a pose a mixer wrote. */
export type SortOrigins = ReadonlyMap<string, Transform2DColumns>;

/** A piece a node draws that the tree does not list, such as a tile row or a scene tile. */
export interface ExtraSortItem {
  readonly id: string;
  /** The point it sorts on, in the space of the node that draws it. */
  readonly origin: Vector2;
  readonly size: number;
}

/** The extra pieces of each node, by live path, in collection order. */
export type ExtraSortItems = ReadonlyMap<string, readonly ExtraSortItem[]>;

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
  results: ReadonlyMap<string, CanvasItemPassResult>,
  paints: ReadonlyMap<string, CanvasItemPaint>,
  origins: SortOrigins,
  extras: ExtraSortItems
): ReadonlyMap<string, PaintRange> {
  const tree = new SortTree(results, paints, origins, extras);
  const runs = new Map<string, PaintRange>();
  for (const [path, result] of results) {
    if (!tree.isSortRoot(path, result)) continue;
    const paint = paints.get(path);
    if (!paint) continue;
    const entries = tree.entriesOf(path);
    // `SortArray` with `ItemYSort` is unstable, but `ysort_index` breaks every tie in collection order.
    const sorted = entries
      .map((entry, index) => ({ entry, index }))
      .sort((a, b) => compareSortY(a.entry.sortY, b.entry.sortY) || a.index - b.index)
      .map(({ entry }) => entry);
    const packed = packPaintRanges(
      paint.range,
      sorted.map((entry) => entry.size),
      paint.range.base
    );
    sorted.forEach((entry, index) => runs.set(entry.id, packed[index]!));
  }
  return runs;
}

/** The pass's results read as Godot's `child_items` lists. */
class SortTree {
  private readonly childItems = new Map<string, string[]>();
  private readonly childNodes = new Map<string, string[]>();

  constructor(
    private readonly results: ReadonlyMap<string, CanvasItemPassResult>,
    private readonly paints: ReadonlyMap<string, CanvasItemPaint>,
    private readonly origins: SortOrigins,
    private readonly extras: ExtraSortItems
  ) {
    for (const [path, result] of results) {
      if (result.parent !== null) listUnder(this.childItems, result.parent, path);
    }
    for (const path of paints.keys()) {
      const parent = parentPathOf(path);
      if (parent !== null) listUnder(this.childNodes, parent, path);
    }
  }

  /** A `sort_y` item that no outer sort flattens: its parent item does not sort, or it has none. */
  isSortRoot(path: string, result: CanvasItemPassResult): boolean {
    if (!result.fields.ySortEnabled || !result.isVisible) return false;
    const parent = result.parent === null ? undefined : this.results.get(result.parent);
    return !parent?.fields.ySortEnabled;
  }

  /** The root as entry 0 at an identity transform, then its flattened subtree (`renderer_canvas_cull.cpp:446-452`). */
  entriesOf(root: string): SortEntry[] {
    const entries: SortEntry[] = [{ id: root, sortY: 0, size: this.bodySize(root) }];
    this.collect(root, TRANSFORM2D_IDENTITY, entries);
    return entries;
  }

  /** `_collect_ysort_children` (`renderer_canvas_cull.cpp:110-160`), with the node's extra pieces first. */
  private collect(path: string, toRoot: Transform2DColumns, entries: SortEntry[]): void {
    for (const extra of this.extras.get(path) ?? []) {
      entries.push({ id: extra.id, sortY: transform2DXform(toRoot, extra.origin).y, size: extra.size });
    }
    for (const child of this.childItems.get(path) ?? []) {
      const result = this.results.get(child)!;
      if (!result.isVisible) continue;
      const xform = multiplyTransform2D(toRoot, this.localOf(child, result));
      const sortsChildren = result.fields.ySortEnabled;
      const size = sortsChildren ? this.bodySize(child) : (this.paints.get(child)?.range.size ?? 0);
      entries.push({ id: child, sortY: xform.ty, size });
      if (sortsChildren) this.collect(child, xform, entries);
    }
  }

  private localOf(path: string, result: CanvasItemPassResult): Transform2DColumns {
    return this.origins.get(path) ?? result.fields.local ?? TRANSFORM2D_IDENTITY;
  }

  /** The values an item draws itself, without the runs its child nodes own. */
  private bodySize(path: string): number {
    const range = this.paints.get(path)?.range.size ?? 0;
    const children = this.childNodes.get(path) ?? [];
    return range - children.reduce((sum, child) => sum + (this.paints.get(child)?.range.size ?? 0), 0);
  }
}

function listUnder(lists: Map<string, string[]>, parent: string, path: string): void {
  const list = lists.get(parent);
  if (list) list.push(path);
  else lists.set(parent, [path]);
}
