/**
 * Sorts the children of a y_sort_enabled node by z bucket, then sort Y, items with an equal Y
 * keeping their collection order, and re-packs its draw-sequence run in that order
 * (`canvasPaintOrder.ts`). A y-sorted TileMapLayer splits into one item per tile row
 * (`ySortRows`), each interleaving with sibling CanvasItems.
 */

import { memo, useId, useLayoutEffect, useMemo } from 'react';
import type { TscnNode } from '../parser/types.js';
import type { TileSetModel } from '../resources/tileset/types.js';
import { ySortRows } from '../resources/tileset/tileYSort.js';
import { drawableCells } from '../resources/tileset/drawableCell.js';
import {
  collectSortRootRows,
  collectYSortedItems,
  ySortItemId,
  Y_SORT_ROOT,
  type YSortItem,
} from './ySortItems.js';
import { TileSetModels, tileSetRefsOf } from './ySortTileSetModels.js';
import { LiftedAncestors, liftedPath } from './LiftedAncestors.js';
import { YSortLayerGroup } from './YSortLayerGroup.js';
import { compareYSortItems } from './ySortOrder.js';
import { useLiveYSort } from './useLiveYSort.js';
import { nodeComponentRegistry } from './NodeComponentRegistry.js';
import {
  allocateNodePaintRange,
  type PaintRange,
  isTopLevelItem,
  packPaintRanges,
  paintRangeSize,
} from './canvasPaintOrder.js';
import { PaintRangeProvider, useCanvasRootRanges, usePaintRange } from './contexts/PaintOrderContext.js';
import { joinPath } from '../utils/nodePath.js';
import { TRANSFORM2D_IDENTITY, transform2DXform } from '../godot/math/transform2d.js';
// Sorted children go back through the one dispatcher, so instances, selection,
// hiding and the workspace split work under y-sort without a copy. The reverse
// edge resolves through `nodeComponentRegistry` at runtime, so there is no cycle.
import { DispatchedNode } from './NodeDispatcher.js';
import { NodePathProvider, useNodePath } from './contexts/NodePathContext.js';
import { hasControl, sceneOrderBasesBelow } from './ySortSceneOrder.js';
import { useLiveDrawnPatchesBelow } from './liveNodePatches.js';
import {
  useControlTransformsUnder,
  usePublishYSortShifts,
  type YSortShift,
} from './contexts/ControlYSortContext.js';

/** Performs the y-sort pass on the children of a y_sort_enabled CanvasItem, and a TileMapLayer's rows. */
export function YSortDispatcher({ node }: { node: TscnNode }) {
  const path = useNodePath() ?? node.name;
  const patches = useLiveDrawnPatchesBelow(path);
  // A sort reads the Controls below it only, so a Control moving under another sort leaves its memo alone.
  const controlTransforms = useControlTransformsUnder(hasControl(node) ? path : null);
  // Collect raw items (y_sort TileMapLayer → one tileGroup placeholder per layer). A layer that
  // roots the sort lists its own rows first, so its children number from 1.
  const rawItems = useMemo(() => {
    const ownRows = collectSortRootRows(node);
    const children = collectYSortedItems(node, Y_SORT_ROOT, ownRows ? 1 : 0, [], {
      path,
      patches,
      controlTransforms,
    });
    return ownRows ? [ownRows, ...children] : children;
  }, [node, path, patches, controlTransforms]);
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
const SortedChildren = memo(function SortedChildren({
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
  // Items sort on the poses drawn now, so a child a mixer moves re-sorts among the rows.
  const liveItems = useLiveYSort(items, basePath);
  const sorted = useMemo(() => [...liveItems].sort(compareYSortItems), [liveItems]);

  // Re-packs this subtree's run in sorted order. Nothing outside can land in the
  // run, and each item keeps a run as wide as its subtree, so its descendants draw
  // between it and the next-ranked item. The items render in collection order, not
  // sorted: a moved child makes R3F apply its authored props again, which undoes the
  // pose a mixer has just written (`ySortAnimatedChild.test.tsx`, "keeps the pose").
  const packed = useMemo(() => {
    // A tile-group item is one group with no subtree, drawn from its layer's
    // reserve. Sized by the layer node, each row would claim a new reserve.
    // `packPaintRanges` keeps rows beyond the reserve out of the next sibling's range.
    const sizes = sorted.map((item) =>
      item.kind === 'tileGroup' || !item.node ? 1 : paintRangeSize(item.node)
    );
    const ranges = packPaintRanges(paintRange, sizes, ownSequence + 1);
    const rangeOf = new Map(sorted.map((item, i) => [ySortItemId(item), ranges[i]!]));
    return inCollectionRuns(liveItems.map((item) => ({ item, range: rangeOf.get(ySortItemId(item))! })));
  }, [sorted, liveItems, ownSequence, paintRange]);

  // The Control walk draws the Control subtrees, so it takes the runs this sort gave them. A layout
  // effect, so the walk and the sort settle before the first paint.
  const publishShifts = usePublishYSortShifts();
  const owner = useId();
  useLayoutEffect(() => {
    if (!publishShifts) return;
    // A node that no longer holds a Control withdraws the shifts it gave, which the unmount cleanup alone would keep.
    if (!hasControl(node)) {
      publishShifts(owner, null);
      return;
    }
    const sceneOrderBases = sceneOrderBasesBelow(node, paintRange, basePath);
    const shifts = new Map<string, YSortShift>();
    for (const { item, range } of packed.flatMap(entriesOf)) {
      if (!item.node || !hasControl(item.node)) continue;
      const path = liftedPath(basePath, item.liftedPast, item.node.name);
      shifts.set(path, { run: range, from: sceneOrderBases.get(path) ?? range.base });
    }
    publishShifts(owner, shifts);
  }, [packed, node, paintRange, basePath, publishShifts, owner]);
  useLayoutEffect(() => () => publishShifts?.(owner, null), [publishShifts, owner]);

  return (
    <>
      {packed.map((run) =>
        run.kind === 'layerRows' ? (
          <LayerRows key={`lr-${run.entries[0]!.item.treeOrder}`} entries={run.entries} basePath={basePath} />
        ) : run.kind === 'rootRows' ? (
          <RootRows key={`rr-${ySortItemId(run.entry.item)}`} entry={run.entry} basePath={basePath} />
        ) : (
          <NodeItem key={`n-${run.entry.item.treeOrder}`} entry={run.entry} basePath={basePath} />
        )
      )}
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
});

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
    tileData: { ...item.tileData!, cells: row.cells, rowOrigin: { ...TRANSFORM2D_IDENTITY, ty: row.y } },
  }));
}

interface PackedItem {
  item: YSortItem;
  range: PaintRange;
}

type CollectionRun =
  | { kind: 'layerRows'; entries: PackedItem[] }
  | { kind: 'rootRows'; entry: PackedItem }
  | { kind: 'node'; entry: PackedItem };

function entriesOf(run: CollectionRun): PackedItem[] {
  return run.kind === 'layerRows' ? run.entries : [run.entry];
}

/** Whether `item` is a row of a y-sorted layer, which a registered renderer draws. */
function isLayerRow(item: YSortItem): boolean {
  return item.kind === 'tileGroup' && !!item.node && !!nodeComponentRegistry.getYSortGroup(item.node.type);
}

/**
 * The entries in collection order, with the rows of one layer gathered into a run. A layer's rows
 * are adjacent in that order (`rowItemsOf`), and the run keeps them below one group.
 * Items without a node draw nothing and are left out.
 */
function inCollectionRuns(packed: readonly PackedItem[]): CollectionRun[] {
  const runs: CollectionRun[] = [];
  for (const entry of packed) {
    if (!entry.item.node) continue;
    const last = runs.at(-1);
    if (!isLayerRow(entry.item)) {
      runs.push({ kind: 'node', entry });
    } else if (entry.item.tileData?.rootsSort) {
      runs.push({ kind: 'rootRows', entry });
    } else if (last?.kind === 'layerRows' && last.entries[0]!.item.treeOrder === entry.item.treeOrder) {
      last.entries.push(entry);
    } else {
      runs.push({ kind: 'layerRows', entries: [entry] });
    }
  }
  return runs;
}

/** One sorted node, dispatched back through the one dispatcher at the sequence the sort gave it. */
function NodeItem({ entry: { item, range }, basePath }: { entry: PackedItem; basePath: string }) {
  const node = item.node!;
  return (
    <PaintRangeProvider value={range}>
      <LiftedAncestors liftedPast={item.liftedPast} basePath={basePath}>
        <DispatchedNode node={node} path={liftedPath(basePath, item.liftedPast, node.name)} />
      </LiftedAncestors>
    </PaintRangeProvider>
  );
}

/**
 * The rows of the layer that is the sort root. The layer's own component holds its group, so the
 * rows draw below it.
 */
function RootRows({ entry: { item, range }, basePath }: { entry: PackedItem; basePath: string }) {
  const Renderer = nodeComponentRegistry.getYSortGroup(item.node!.type)!.Renderer;
  return (
    <PaintRangeProvider value={range}>
      <LiftedAncestors liftedPast={item.liftedPast} basePath={basePath}>
        <NodePathProvider path={liftedPath(basePath, item.liftedPast, item.node!.name)}>
          <Renderer item={item} node={item.node!} />
        </NodePathProvider>
      </LiftedAncestors>
    </PaintRangeProvider>
  );
}

/** The rows of one layer below the layer's group, each at the draw sequence the sort gave it. */
function LayerRows({ entries, basePath }: { entries: readonly PackedItem[]; basePath: string }) {
  const { liftedPast, node } = entries[0]!.item;
  const path = liftedPath(basePath, liftedPast, node!.name);
  const Renderer = nodeComponentRegistry.getYSortGroup(node!.type)!.Renderer;
  return (
    <LiftedAncestors liftedPast={liftedPast} basePath={basePath}>
      <YSortLayerGroup node={node!} path={path}>
        {entries.map(({ item, range }) => (
          // The row's whole draw position rides its group as one paint sequence. Its meshes order
          // within it by their own `renderOrder`, a batching artifact, not a draw position.
          <PaintRangeProvider key={ySortItemId(item)} value={range}>
            <NodePathProvider path={path}>
              <Renderer item={item} node={item.node!} />
            </NodePathProvider>
          </PaintRangeProvider>
        ))}
      </YSortLayerGroup>
    </LiftedAncestors>
  );
}
