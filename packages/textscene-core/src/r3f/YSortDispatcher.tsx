/**
 * Sorts the children of a y_sort_enabled node by z bucket, then sort Y, items with an equal Y
 * keeping their collection order, and re-packs its draw-sequence run in that order
 * (`canvasPaintOrder.ts`). A y-sorted TileMapLayer splits into one item per tile row
 * (`ySortRows`), each interleaving with sibling CanvasItems.
 */

import { useMemo, type ReactNode } from 'react';
import type { TscnNode } from '../parser/types.js';
import type { TileSetModel } from '../resources/tileset/types.js';
import { ySortRows } from '../resources/tileset/tileYSort.js';
import { drawableCells } from '../resources/tileset/drawableCell.js';
import { collectYSortedItems, ySortItemId, Y_SORT_ROOT, type YSortItem } from './ySortItems.js';
import { TileSetModels, tileSetRefsOf } from './ySortTileSetModels.js';
import { LiftedAncestors, liftedPath } from './LiftedAncestors.js';
import { nodeComponentRegistry } from './NodeComponentRegistry.js';
import {
  allocateNodePaintRange,
  isTopLevelItem,
  packPaintRanges,
  paintRangeSize,
} from './canvasPaintOrder.js';
import { PaintRangeProvider, useCanvasRootRanges, usePaintRange } from './contexts/PaintOrderContext.js';
import { joinPath } from '../utils/nodePath.js';
import { isEqualApprox } from '../godot/math/math.js';
import { transform2DXform } from '../godot/math/transform2d.js';
// Sorted children go back through the one dispatcher, so instances, selection,
// hiding and the workspace split work under y-sort without a copy. The reverse
// edge resolves through `nodeComponentRegistry` at runtime, so there is no cycle.
import { DispatchedNode } from './NodeDispatcher.js';
import { NodePathProvider, useNodePath } from './contexts/NodePathContext.js';

/** Performs the y-sort pass on a y_sort_enabled Node2D's children. */
export function YSortDispatcher({ node, children: _children }: { node: TscnNode; children: ReactNode }) {
  // Collect raw items (y_sort TileMapLayer → one tileGroup placeholder per layer).
  const rawItems = useMemo(() => collectYSortedItems(node, Y_SORT_ROOT, 0), [node]);
  // Each y-sorted layer expands against its own grid, so every distinct
  // `tile_set` in the list is resolved, not just the first one's.
  const refs = useMemo(() => tileSetRefsOf(rawItems), [rawItems]);

  return (
    <TileSetModels refs={refs}>
      {(models) => <SortedChildren node={node} rawItems={rawItems} models={models} />}
    </TileSetModels>
  );
}

/** The sort and re-dispatch, once every y-sorted layer's TileSet is in hand. */
function SortedChildren({
  node,
  rawItems,
  models,
}: {
  node: TscnNode;
  rawItems: readonly YSortItem[];
  models: ReadonlyMap<string, TileSetModel>;
}) {
  // Sorted children are re-dispatched from here rather than from their position
  // in the tree, so their selection paths have to be rebuilt from this node's
  // own path (the dispatcher provided it when it rendered this node).
  const basePath = useNodePath() ?? node.name;
  // The sorted items draw after this node's own sequence, as Godot appends the
  // y-sorted node before descending (`_collect_ysort_children`).
  const paintRange = usePaintRange();
  const allocated = useMemo(() => allocateNodePaintRange(paintRange, node), [paintRange, node]);
  const ownSequence = allocated.self;
  // A top_level child is no `child_item` of this node, so the sort skipped it
  // (`ySortItems.ts`) and it draws here, by the same predicate. The canvas root
  // index is absent inside an `instance=` subtree.
  const canvasRoots = useCanvasRootRanges();
  const topLevelChildren = useMemo(
    () =>
      node.children.map((child, index) => ({ child, index })).filter(({ child }) => isTopLevelItem(child)),
    [node.children]
  );

  // Each y-sorted layer becomes one item per row, in its place in the collection order.
  const items = useMemo(
    () => rawItems.flatMap((item) => rowItemsOf(item, models) ?? [item]),
    [rawItems, models]
  );
  const sorted = useMemo(() => [...items].sort(compareYSortItems), [items]);

  // Re-packs this subtree's run in sorted order. Nothing outside can land in the
  // run, and each item keeps a run as wide as its subtree, so its descendants draw
  // between it and the next-ranked item.
  const packed = useMemo(() => {
    // A tile-group item is one group with no subtree, drawn from its layer's
    // reserve. Sized by the layer node, each row would claim a new reserve.
    // `packPaintRanges` keeps rows beyond the reserve out of the next sibling's range.
    const sizes = sorted.map((item) =>
      item.kind === 'tileGroup' || !item.node ? 1 : paintRangeSize(item.node)
    );
    const ranges = packPaintRanges(paintRange, sizes, ownSequence + 1);
    return sorted.map((item, i) => ({ item, range: ranges[i]! }));
  }, [sorted, ownSequence, paintRange]);

  return (
    <>
      {packed.map(({ item, range }) => {
        const Renderer = item.node
          ? nodeComponentRegistry.getYSortGroup(item.node.type)?.Renderer
          : undefined;
        if (item.kind === 'tileGroup' && item.node && Renderer) {
          // The row's whole draw position rides its group as one paint sequence. Its meshes
          // order within it by their own `renderOrder`, a batching artifact, not a draw position.
          return (
            <PaintRangeProvider key={`tg-${item.node.name}-${ySortItemId(item)}`} value={range}>
              <LiftedAncestors liftedPast={item.liftedPast} basePath={basePath}>
                <NodePathProvider path={liftedPath(basePath, item.liftedPast, item.node.name)}>
                  <Renderer item={item} node={item.node} />
                </NodePathProvider>
              </LiftedAncestors>
            </PaintRangeProvider>
          );
        }

        if (item.node) {
          return (
            <PaintRangeProvider key={`n-${item.treeOrder}`} value={range}>
              <LiftedAncestors liftedPast={item.liftedPast} basePath={basePath}>
                <DispatchedNode
                  node={item.node}
                  path={liftedPath(basePath, item.liftedPast, item.node.name)}
                />
              </LiftedAncestors>
            </PaintRangeProvider>
          );
        }
        return null;
      })}
      {topLevelChildren.map(({ child, index }) => (
        <PaintRangeProvider
          key={`tl-${child.name}`}
          value={canvasRoots.get(child) ?? allocated.children[index]!}
        >
          <DispatchedNode node={child} path={joinPath(basePath, child.name)} />
        </PaintRangeProvider>
      ))}
    </>
  );
}

/**
 * The rows of a y-sorted TileMapLayer item, each a child canvas item of the layer at `(0, row y)`
 * (`tile_map_layer.cpp:352-353`), so its sort y is that point in the sort root's space. Null for
 * any other item, and for a layer whose TileSet has not arrived, which draws whole.
 */
function rowItemsOf(item: YSortItem, models: ReadonlyMap<string, TileSetModel>): YSortItem[] | null {
  const model = item.tileData ? models.get(item.tileData.tileSetRef) : undefined;
  const group = item.node ? nodeComponentRegistry.getYSortGroup(item.node.type) : undefined;
  if (item.kind !== 'tileGroup' || !item.node || !model || !group) return null;
  const layer = group.describe(item.node);
  if (!layer.cells?.length) return null;
  const toSortRoot = item.tileData!.toSortRoot;
  return ySortRows(drawableCells(model, layer.cells), model, layer.ySortOrigin).map((row, groupIndex) => ({
    ...item,
    sortY: transform2DXform(toSortRoot, { x: 0, y: row.y }).y,
    groupIndex,
    tileData: { ...item.tileData!, cells: row.cells },
  }));
}

/**
 * Godot's order for one flat sort: the z bucket, then the sort y, and items whose y is equal
 * within `is_equal_approx` keep their collection order (`renderer_canvas_cull.h:115-123`).
 */
function compareYSortItems(a: YSortItem, b: YSortItem): number {
  if (a.effectiveZ !== b.effectiveZ) return a.effectiveZ - b.effectiveZ;
  return isEqualApprox(a.sortY, b.sortY) ? 0 : a.sortY - b.sortY;
}
