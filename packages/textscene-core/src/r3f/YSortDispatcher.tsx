/**
 * YSortDispatcher — collects children of a y_sort_enabled node, sorts them
 * by (effectiveZ bucket → sortY → tree order), assigns rank-based z, and
 * re-renders in that order.
 *
 * Within-bucket rank-based z sub-steps:
 *   z = effectiveZ * Z_INDEX_STEP + ((rank + 1) / (K + 1)) * slot.width
 * where slot.width (≤ Z_INDEX_STEP * 0.5) is this y-sort subtree's allotted
 * draw-order band (narrowed when sibling y-sort subtrees share a z-index step).
 *
 * A y_sort_enabled TileMapLayer is decomposed per-Y-group via `groupBySortY`:
 * each distinct sort-Y becomes a separate tileGroup item at its own rank,
 * interleaving with sibling CanvasItem nodes in the parent's flat sort.
 *
 * The collection is in `ySortItems.ts`, the per-row tile rendering in
 * `TileGroupRenderer.tsx`, and the restoration of what the flattening removed
 * in `LiftedAncestors.tsx`.
 */

import { Fragment, useMemo, type ReactNode } from 'react';
import type { TscnNode } from '../parser/types.js';
import { useYSortContext, useYSortSlot } from './contexts/YSortContext.js';
import { Z_INDEX_STEP } from './node2dTransform.js';
import type { TileMapLayerProperties } from '../nodes/2d/tiles/tilemaplayer/types.js';
import { useTileSetModel } from './useTileSetModel.js';
import { groupBySortY } from '../resources/tileset/tileYSort.js';
import type { YSortGroup } from '../resources/tileset/tileYSort.js';
import { collectYSortedItems, type YSortItem } from './ySortItems.js';
import { LiftedAncestors, liftedPath } from './LiftedAncestors.js';
import { TileGroupRenderer } from './TileGroupRenderer.js';
import { YSortSlotProvider, YSortZProvider } from './contexts/YSortContext.js';
// Sorted children go back through the ONE dispatcher rather than a second
// renderer here: that is what keeps `instance=` sub-scenes, selection
// registration, hidden-node gating and the workspace split working under
// y-sort without a copy of each that can drift. The reverse edge
// (Node2D → YSortDispatcher) resolves through `nodeComponentRegistry` at
// runtime, so this import introduces no static cycle.
import { DispatchedNode } from './DispatchedNode.js';
import { useNodePath } from './contexts/NodePathContext.js';

/**
 * <YSortDispatcher> — the component that performs the y-sort pass on a
 * y_sort_enabled Node2D's children.
 */
export function YSortDispatcher({ node, children: _children }: { node: TscnNode; children: ReactNode }) {
  const parent = useYSortContext();
  // Sorted children are re-dispatched from here rather than from their position
  // in the tree, so their selection paths have to be rebuilt from this node's
  // own path (the dispatcher provided it when it rendered this node).
  const basePath = useNodePath() ?? node.name;
  // Ranks are laid out within THIS subtree's tree-order slot width (so sibling
  // y-sort subtrees don't overlap); the slot base is already in the group's z.
  const slot = useYSortSlot();

  // Collect raw items (y_sort TileMapLayer → one tileGroup placeholder per layer).
  const rawItems = useMemo(() => collectYSortedItems(node, parent, 0), [node, parent]);

  // Resolve the tileset for any y-sorted TileMapLayer child so we can expand
  // it into per-Y-group items (the dungeon fix).
  const tileSetRef = useMemo(() => {
    const tl = rawItems.find(i => i.kind === 'tileGroup' && i.node);
    if (!tl?.node) return undefined;
    return (tl.node.properties as TileMapLayerProperties).tile_set;
  }, [rawItems]);
  const { model, status } = useTileSetModel(tileSetRef);

  // Expand tileGroup items into per-Y-group items using groupBySortY,
  // then flatten (preserving tree-order position of the original layer).
  const items = useMemo<YSortItem[]>(() => {
    const expanded: YSortItem[] = [];
    for (const item of rawItems) {
      if (item.kind === 'tileGroup' && item.node && model && status === 'loaded') {
        const tp = item.node.properties as TileMapLayerProperties;
        const cells = tp.cells;
        if (cells?.length) {
          const grid = model;
          const layerYSortOrigin = (tp.y_sort_origin as number) ?? 0;
          // groupBySortY adds layerYSortOrigin to each cell's sort key itself, so the
          // layer world-Y passed in must NOT include it (else the origin double-counts).
          // Taken from the ITEM, which carries the Y accumulated through every
          // y_sort_enabled ancestor. `parent` here is the sort root's context,
          // so recomputing from it would drop those offsets and sort the layer's
          // rows against a different origin than the siblings it interleaves with.
          const layerWorldY = item.tileData?.worldY ?? 0;
          const groups: YSortGroup[] = groupBySortY(cells, grid, layerYSortOrigin, layerWorldY);
          for (let g = 0; g < groups.length; g++) {
            const group = groups[g]!;
            // Filter cells to this Y-group's cells only.
            expanded.push({
              sortY: group.sortY,
              effectiveZ: item.effectiveZ,
              treeOrder: item.treeOrder + g,
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
  }, [rawItems, model, status]);

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

  return (
    <>
      {sorted.map(({ item, rank, bucketSize: K }) => {
        const sortZ = ((rank + 1) / (K + 1)) * slot.width;
        const fullZ = item.effectiveZ * Z_INDEX_STEP + sortZ;

        if (item.kind === 'tileGroup' && item.node) {
          // The Y-group's whole draw position (z-index bucket + rank) rides the group;
          // its meshes sit at their own per-source sub-step RELATIVE to it (see the
          // group's `position` below), so the rank is applied ONCE. Key on the layer's
          // name so sibling y-sort TileMapLayers can't collide on a shared treeOrder.
          return (
            <Fragment key={`tg-${item.node.name}-${item.treeOrder}`}>
              <LiftedAncestors liftedPast={item.liftedPast}>
                <TileGroupRenderer
                  item={item}
                  z={fullZ}
                  band={slot.width / (K + 1)}
                  node={item.node}
                />
              </LiftedAncestors>
            </Fragment>
          );
        }

        if (item.node) {
          // The item's own descendants draw between its rank and the next one,
          // so hand them exactly that gap. Without the narrowing a nested
          // subtree spends the whole fine range and reaches past its sibling's
          // rank, which reverses the pair the sort just ordered.
          return (
            <YSortZProvider key={`n-${item.treeOrder}`} value={fullZ}>
              <YSortSlotProvider value={{ base: 0, width: slot.width / (K + 1) }}>
                <LiftedAncestors liftedPast={item.liftedPast}>
                  <DispatchedNode
                    node={item.node}
                    path={liftedPath(basePath, item.liftedPast, item.node.name)}
                  />
                </LiftedAncestors>
              </YSortSlotProvider>
            </YSortZProvider>
          );
        }
        return null;
      })}
    </>
  );
}
