/**
 * Sorts the children of a y_sort_enabled node by z bucket, then sort Y, then tree
 * order, and re-packs its draw-sequence run in that order (`canvasPaintOrder.ts`).
 * A y-sorted TileMapLayer splits into one item per tile row (`groupBySortY`), each
 * interleaving with sibling CanvasItems.
 */

import { Fragment, useMemo, type ReactNode } from 'react';
import type { TscnNode } from '../parser/types.js';
import { useYSortContext } from './contexts/YSortContext.js';
import type { TileSetModel } from '../resources/tileset/types.js';
import { groupBySortY } from '../resources/tileset/tileYSort.js';
import type { YSortGroup } from '../resources/tileset/tileYSort.js';
import { collectYSortedItems, ySortItemId, type YSortItem } from './ySortItems.js';
import { TileSetModels, tileSetRefsOf } from './ySortTileSetModels.js';
import { LiftedAncestors, liftedPath } from './LiftedAncestors.js';
import { nodeComponentRegistry } from './NodeComponentRegistry.js';
import {
  allocatePaintRange,
  isTopLevelItem,
  packPaintRanges,
  paintRangeSize,
} from './canvasPaintOrder.js';
import {
  PaintRangeProvider,
  useCanvasRootRanges,
  useLayerRank,
  usePaintRange,
} from './contexts/PaintOrderContext.js';
import { joinPath } from '../utils/nodePath.js';
import { useCanvasLayerIndex } from './lighting2d/canvasItemPlacement.js';
// Sorted children go back through the one dispatcher, so instances, selection,
// hiding and the workspace split work under y-sort without a copy. The reverse
// edge resolves through `nodeComponentRegistry` at runtime, so there is no cycle.
import { DispatchedNode } from './NodeDispatcher.js';
import { useNodePath } from './contexts/NodePathContext.js';

/** Performs the y-sort pass on a y_sort_enabled Node2D's children. */
export function YSortDispatcher({ node, children: _children }: { node: TscnNode; children: ReactNode }) {
  const parent = useYSortContext();

  // Collect raw items (y_sort TileMapLayer → one tileGroup placeholder per layer).
  const rawItems = useMemo(() => collectYSortedItems(node, parent, 0), [node, parent]);
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
  const allocated = useMemo(
    () => allocatePaintRange(paintRange, node.children, true),
    [paintRange, node.children]
  );
  const ownSequence = allocated.self;
  const layerRank = useLayerRank(useCanvasLayerIndex());
  // A top_level child is no `child_item` of this node, so the sort skipped it
  // (`ySortItems.ts`) and it draws here, by the same predicate. The canvas root
  // index is absent inside an `instance=` subtree.
  const canvasRoots = useCanvasRootRanges();
  const topLevelChildren = useMemo(
    () =>
      node.children
        .map((child, index) => ({ child, index }))
        .filter(({ child }) => isTopLevelItem(child)),
    [node.children]
  );

  // Expand tileGroup items into per-Y-group items using groupBySortY,
  // then flatten (preserving tree-order position of the original layer).
  const items = useMemo<YSortItem[]>(() => {
    const expanded: YSortItem[] = [];
    for (const item of rawItems) {
      const grid = item.tileData ? models.get(item.tileData.tileSetRef) : undefined;
      const group = item.node ? nodeComponentRegistry.getYSortGroup(item.node.type) : undefined;
      if (item.kind === 'tileGroup' && item.node && grid && group) {
        const layer = group.describe(item.node);
        const cells = layer.cells;
        if (cells?.length) {
          const layerYSortOrigin = layer.ySortOrigin;
          // Without layerYSortOrigin, which groupBySortY adds itself. From the item,
          // which carries the Y of every y_sort_enabled ancestor, so the rows sort
          // against the origin of the siblings they interleave with.
          const layerWorldY = item.tileData?.worldY ?? 0;
          const groups: YSortGroup[] = groupBySortY(cells, grid, layerYSortOrigin, layerWorldY);
          for (let g = 0; g < groups.length; g++) {
            const group = groups[g]!;
            // Filter cells to this Y-group's cells only.
            expanded.push({
              sortY: group.sortY,
              effectiveZ: item.effectiveZ,
              treeOrder: item.treeOrder,
              groupIndex: g,
              kind: 'tileGroup',
              tileData: { ...item.tileData!, cells: group.cells },
              node: item.node,
              liftedPast: item.liftedPast,
            });
          }
          continue;
        }
      }
      expanded.push(item);
    }
    return expanded;
  }, [rawItems, models]);

  // Bucket by effectiveZ, sort within each bucket by sortY ascending (stable),
  // then assign rank-based z within each bucket.
  const sorted = useMemo(() => {
    const sorted = [...items]
      .sort((a, b) => {
        if (a.effectiveZ !== b.effectiveZ) return a.effectiveZ - b.effectiveZ;
        return a.sortY - b.sortY;
      });

    const buckets = new Map<number, typeof sorted>();
    for (const item of sorted) {
      const bucket = buckets.get(item.effectiveZ);
      if (bucket) bucket.push(item);
      else buckets.set(item.effectiveZ, [item]);
    }

    // `bucketSize` rides each entry: a re-scan per item is quadratic, and a
    // y-sorted TileMapLayer gives one item per tile row.
    const result: Array<{ item: YSortItem; rank: number; bucketSize: number }> = [];
    for (const effZ of [...buckets.keys()].sort((a, b) => a - b)) {
      const bucket = buckets.get(effZ)!;
      for (let g = 0; g < bucket.length; g++) {
        result.push({ item: bucket[g]!, rank: g, bucketSize: bucket.length });
      }
    }
    return result;
  }, [items]);

  // Re-packs this subtree's run in sorted order. Nothing outside can land in the
  // run, and each item keeps a run as wide as its subtree, so its descendants draw
  // between it and the next-ranked item.
  const packed = useMemo(() => {
    // A tile-group item is one group with no subtree, drawn from its layer's
    // reserve. Sized by the layer node, each row would claim a new reserve.
    // `packPaintRanges` keeps rows beyond the reserve out of the next sibling's range.
    const sizes = sorted.map(({ item }) =>
      item.kind === 'tileGroup' || !item.node ? 1 : paintRangeSize(item.node)
    );
    const ranges = packPaintRanges(paintRange, sizes, ownSequence + 1);
    return sorted.map(({ item }, i) => ({ item, range: ranges[i]! }));
  }, [sorted, ownSequence, paintRange]);

  return (
    <>
      {packed.map(({ item, range }) => {
        const Renderer = item.node ? nodeComponentRegistry.getYSortGroup(item.node.type)?.Renderer : undefined;
        if (item.kind === 'tileGroup' && item.node && Renderer) {
          // The row's whole draw position rides the group as one paint sequence;
          // its meshes order within it by their own `renderOrder`, a batching
          // artifact rather than a draw position.
          return (
            <Fragment key={`tg-${item.node.name}-${ySortItemId(item)}`}>
              <LiftedAncestors liftedPast={item.liftedPast}>
                <Renderer
                  item={item}
                  layerRank={layerRank}
                  sequence={range.base}
                  node={item.node}
                />
              </LiftedAncestors>
            </Fragment>
          );
        }

        if (item.node) {
          return (
            <PaintRangeProvider key={`n-${item.treeOrder}`} value={range}>
              <LiftedAncestors liftedPast={item.liftedPast}>
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
