/**
 * YSortDispatcher — collects children of a y_sort_enabled node, sorts them
 * by (effectiveZ bucket → sortY → tree order), and re-renders in that order.
 *
 * The sort reaches the renderer as DRAW SEQUENCE: this node owns a contiguous
 * run of sequence values covering its whole subtree (`canvasPaintOrder.ts`),
 * and the pass re-packs that run in sorted order. Self-contained by
 * construction — nothing outside can land inside the run — and each item keeps
 * a sub-run as wide as its own subtree needs, so a sorted item's descendants
 * draw between it and the next-ranked item with no budget to ration.
 *
 * A y_sort_enabled TileMapLayer is decomposed per-Y-group via `groupBySortY`:
 * each distinct sort-Y becomes a separate tileGroup item at its own rank,
 * interleaving with sibling CanvasItem nodes in the parent's flat sort.
 *
 * The collection is in `ySortItems.ts`, the per-layer TileSet resolution in
 * `ySortTileSetModels.tsx`, the per-row tile rendering in
 * `TileGroupRenderer.tsx`, and the restoration of what the flattening removed
 * in `LiftedAncestors.tsx`.
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
  packPaintRanges,
  paintRangeSize,
} from './canvasPaintOrder.js';
import { PaintRangeProvider, useLayerRank, usePaintRange } from './contexts/PaintOrderContext.js';
import { useCanvasLayerIndex } from './lighting2d/canvasItemPlacement.js';
// Sorted children go back through the ONE dispatcher rather than a second
// renderer here: that is what keeps `instance=` sub-scenes, selection
// registration, hidden-node gating and the workspace split working under
// y-sort without a copy of each that can drift. The reverse edge
// (Node2D → YSortDispatcher) resolves through `nodeComponentRegistry` at
// runtime, so this import introduces no static cycle.
import { DispatchedNode } from './NodeDispatcher.js';
import { useNodePath } from './contexts/NodePathContext.js';

/**
 * <YSortDispatcher> — the component that performs the y-sort pass on a
 * y_sort_enabled Node2D's children.
 */
export function YSortDispatcher({ node, children: _children }: { node: TscnNode; children: ReactNode }) {
  const parent = useYSortContext();

  // Collect raw items (y_sort TileMapLayer → one tileGroup placeholder per layer).
  const rawItems = useMemo(() => collectYSortedItems(node, parent, 0), [node, parent]);
  // Each y-sorted layer expands against its OWN grid, so every distinct
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
  // This node's own run of draw-sequence values, and the sequence it draws its
  // own pixels at — the sorted items go after it, exactly as Godot appends the
  // y-sorted node itself before descending (`_collect_ysort_children`).
  const paintRange = usePaintRange();
  const ownSequence = useMemo(
    () => allocatePaintRange(paintRange, node.children, true).self,
    [paintRange, node.children]
  );
  const layerRank = useLayerRank(useCanvasLayerIndex());

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
          // groupBySortY adds layerYSortOrigin to each cell's sort key itself, so the
          // layer world-Y passed in must NOT include it (else the origin double-counts).
          // Taken from the ITEM, which carries the Y accumulated through every
          // y_sort_enabled ancestor: recomputing it from the sort root's context
          // would drop those offsets and sort the layer's rows against a
          // different origin than the siblings it interleaves with.
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

    // `bucketSize` rides each entry: the rank fraction below needs it, and
    // recovering it per item by re-scanning the list is quadratic — a y-sorted
    // TileMapLayer decomposes into one item per distinct tile row, so this list
    // runs to the hundreds on a real map.
    const result: Array<{ item: YSortItem; rank: number; bucketSize: number }> = [];
    for (const effZ of [...buckets.keys()].sort((a, b) => a - b)) {
      const bucket = buckets.get(effZ)!;
      for (let g = 0; g < bucket.length; g++) {
        result.push({ item: bucket[g]!, rank: g, bucketSize: bucket.length });
      }
    }
    return result;
  }, [items]);

  // Re-pack this subtree's own run of draw-sequence values in SORTED order.
  //
  // The run was allocated by tree position and sized to cover the whole
  // subtree, so re-laying it out here is self-contained: nothing outside can
  // land inside it, whatever order this pass chooses. Each item keeps a run as
  // wide as its own subtree needs, which is what lets a sorted item's
  // descendants draw between it and the next-ranked item without a budget to
  // ration — the reason the fractional scheme this replaces had to narrow a
  // shrinking float band at every level.
  const packed = useMemo(() => {
    // A tile-group item is ONE drawn group with no subtree — several of them
    // come out of a single layer, and they are what that layer's own reserve
    // was held back for. Sizing them by the layer node they name would claim
    // a fresh reserve PER ROW and run off the end of the parent's run.
    //
    // Packed through `packPaintRanges` rather than a bare cursor because the
    // ROW COUNT is only known once the tileset resolves: a layer with more
    // distinct sort-Y rows than its reserve held would otherwise walk into the
    // next sibling's range and reorder it.
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
          // its meshes order WITHIN it by their own `renderOrder`, a batching
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
    </>
  );
}
