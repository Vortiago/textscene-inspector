/**
 * Draws the children of a y_sort_enabled node at the runs the one sort of its canvas gives them
 * (`canvasItemPass/ySort.ts`). A y-sorted TileMapLayer splits into one item per tile row
 * (`ySortRows`), and the dispatcher hands the sort each row, scene tile and TileMap layer the pass
 * does not list, with the ys a mixer pose gives its items.
 */

import { memo, useId, useLayoutEffect, useMemo } from 'react';
import type { TscnNode } from '../parser/types.js';
import type { TileSetModel } from '../resources/tileset/types.js';
import { ySortRows } from '../resources/tileset/tileYSort.js';
import { drawableCells } from '../resources/tileset/drawableCell.js';
import {
  collectSortRootRows,
  collectYSortedItems,
  hasControl,
  ySortItemId,
  Y_SORT_ROOT,
  type YSortItem,
} from './ySortItems.js';
import { TileSetModels, tileSetRefsOf } from './ySortTileSetModels.js';
import { LiftedAncestors, liftedPath } from './LiftedAncestors.js';
import { YSortLayerGroup } from './YSortLayerGroup.js';
import { inSortOrder } from './ySortOrder.js';
import { useLiveYSort } from './useLiveYSort.js';
import { nodeComponentRegistry } from './NodeComponentRegistry.js';
import { isTopLevelItem, packPaintRanges, paintRangeSize } from './canvasPaintOrder.js';
import {
  IN_TREE_ORDER,
  PaintFrameProvider,
  runFrame,
  useChildPaintFrames,
  useNodePaint,
  type PaintFrame,
} from './canvasItemPass/nodePaint.js';
import { canvasPaintPass, type CanvasItemPaint } from './canvasItemPass/canvasItemPaint.js';
import type { ExtraSortItem } from './canvasItemPass/ySort.js';
import { useLiveScenePassSelection } from './liveScenePass.js';
import { joinPath } from '../utils/nodePath.js';
import { sameData } from '../utils/sameData.js';
import { TRANSFORM2D_IDENTITY, transform2DXform } from '../godot/math/transform2d.js';
// Sorted children go back through the one dispatcher, so instances, selection,
// hiding and the workspace split work under y-sort without a copy. The reverse
// edge resolves through `nodeComponentRegistry` at runtime, so there is no cycle.
import { DispatchedNode } from './NodeDispatcher.js';
import { NodePathProvider, useNodePath } from './contexts/NodePathContext.js';
import { useLiveDrawnPatchesBelow } from './liveNodePatches.js';
import { useWithExtraChildren } from './ySortExtraChildren.js';
import {
  useControlTransformsUnder,
  usePublishLiveSortYs,
  usePublishSortExtras,
  useSortedRunsAndPaints,
} from './contexts/YSortContext.js';

/** Performs the y-sort pass on the children of a y_sort_enabled CanvasItem, and a TileMapLayer's rows. */
export function YSortDispatcher({ node: authored }: { node: TscnNode }) {
  const path = useNodePath() ?? authored.name;
  const node = useWithExtraChildren(authored, path);
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
  const paint = useNodePaint(node, basePath);
  // A top_level child is no `child_item` of this node, so the sort skipped it
  // (`ySortItems.ts`) and it draws here, by the same predicate, at the run the
  // canvas root index gives it, which no sort moves.
  const childFrames = useChildPaintFrames(node, basePath, paint);
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
  const pieces = useSortPieces(items, basePath);
  usePublishSortInputs(items, liveItems, pieces, basePath);
  const frames = usePieceFrames(items, liveItems, pieces, paint, childFrames !== null);

  // The items render in collection order, not sorted: a moved child makes R3F apply its authored
  // props again, which undoes the pose a mixer has just written (`ySortAnimatedChild.test.tsx`,
  // "keeps the pose"). Each one reads where the sort put it.
  const runs = useMemo(() => inCollectionRuns(liveItems, frames), [liveItems, frames]);

  return (
    <>
      {runs.map((run) =>
        run.kind === 'layerRows' ? (
          <LayerRows key={`lr-${run.entries[0]!.item.treeOrder}`} entries={run.entries} basePath={basePath} />
        ) : run.kind === 'rootRows' ? (
          <RootRows key={`rr-${ySortItemId(run.entry.item)}`} entry={run.entry} basePath={basePath} />
        ) : (
          <NodeItem key={`n-${run.entry.item.treeOrder}`} entry={run.entry} basePath={basePath} />
        )
      )}
      {topLevelChildren.map(({ child, index }) => (
        <PaintFrameProvider key={`tl-${child.name}`} value={childFrames?.children[index] ?? IN_TREE_ORDER}>
          <DispatchedNode node={child} path={joinPath(basePath, child.name)} />
        </PaintFrameProvider>
      ))}
    </>
  );
});

/**
 * Each item's id in the sort of the canvas item pass: its live path for a node the pass holds, or an
 * extra id for a piece the pass does not list, such as a tile row, a TileMap's layer or a scene tile.
 */
function useSortPieces(items: readonly YSortItem[], basePath: string): ReadonlyMap<YSortItem, SortPiece> {
  const paths = useMemo(() => items.map((item) => itemPath(item, basePath)), [items, basePath]);
  const select = useMemo(
    () => (paints: ReadonlyMap<string, CanvasItemPaint>) => paths.map((path) => paints.has(path)),
    [paths]
  );
  const held = useLiveScenePassSelection(canvasPaintPass, select, sameData);
  return useMemo(
    () =>
      new Map(
        items.map((item, i): [YSortItem, SortPiece] =>
          item.kind === 'node' && held?.[i]
            ? [item, { kind: 'node', id: paths[i]! }]
            : [item, { kind: 'extra', id: `${basePath}#${ySortItemId(item)}` }]
        )
      ),
    [items, paths, held, basePath]
  );
}

/**
 * Publishes the pieces the pass does not list as extras of this node, and the ys a mixer pose gives
 * the items, so the one sort places them. A layout effect, so the sort settles before the first paint.
 */
function usePublishSortInputs(
  items: readonly YSortItem[],
  liveItems: readonly YSortItem[],
  pieces: ReadonlyMap<YSortItem, SortPiece>,
  basePath: string
): void {
  const publishExtras = usePublishSortExtras();
  const publishLiveYs = usePublishLiveSortYs();
  const owner = useId();
  useLayoutEffect(() => {
    // The sort y of an item is in this node's space, where an extra's origin sits.
    const extras = items.flatMap((item): ExtraSortItem[] => {
      const piece = pieces.get(item)!;
      if (piece.kind !== 'extra' || !item.node) return [];
      return [
        { id: piece.id, origin: { x: 0, y: item.sortY }, size: pieceSize(item), isInternalBack: false },
      ];
    });
    publishExtras?.(owner, new Map([[basePath, extras]]));
  }, [items, pieces, basePath, publishExtras, owner]);
  useLayoutEffect(() => {
    const ys = new Map<string, number>();
    liveItems.forEach((live, i) => {
      if (live !== items[i]) ys.set(pieces.get(items[i]!)!.id, live.sortY);
    });
    publishLiveYs?.(owner, ys);
  }, [items, liveItems, pieces, publishLiveYs, owner]);
  useLayoutEffect(
    () => () => {
      publishExtras?.(owner, null);
      publishLiveYs?.(owner, null);
    },
    [publishExtras, publishLiveYs, owner]
  );
}

/**
 * The frame each item draws in. Inside the shared live tree, a node reads its sorted paint by path
 * and an extra takes the run the sort gave its id. A subtree outside that tree, such as a scene
 * tile's instance, has no pass to sort, so it packs its own run here in the same order.
 */
function usePieceFrames(
  items: readonly YSortItem[],
  liveItems: readonly YSortItem[],
  pieces: ReadonlyMap<YSortItem, SortPiece>,
  paint: CanvasItemPaint,
  isOutsideTree: boolean
): ReadonlyMap<YSortItem, PaintFrame> {
  const sortedRuns = useSortedRunsAndPaints().runs;
  return useMemo(() => {
    if (isOutsideTree) return localSortFrames(liveItems, paint);
    return new Map(
      liveItems.map((live, i): [YSortItem, PaintFrame] => {
        const piece = pieces.get(items[i]!)!;
        if (piece.kind === 'node') return [live, IN_TREE_ORDER];
        return [live, runFrame(sortedRuns.get(piece.id) ?? paint.tail)];
      })
    );
  }, [items, liveItems, pieces, paint, isOutsideTree, sortedRuns]);
}

/** The runs of `items` packed in sort order after the node's own sequence, as one flat sort orders them. */
function localSortFrames(items: readonly YSortItem[], paint: CanvasItemPaint): Map<YSortItem, PaintFrame> {
  const sorted = inSortOrder(items, (item) => item.sortY);
  const ranges = packPaintRanges(paint.range, sorted.map(pieceSize), paint.own + 1);
  return new Map(sorted.map((item, i) => [item, runFrame(ranges[i]!)]));
}

/** The values an item draws: one for a row, which is one group with no subtree, or its whole subtree's run. */
function pieceSize(item: YSortItem): number {
  return item.kind === 'tileGroup' || !item.node ? 1 : paintRangeSize(item.node);
}

function itemPath(item: YSortItem, basePath: string): string {
  return item.node ? liftedPath(basePath, item.liftedPast, item.node.name) : basePath;
}

/** Where the sort of the canvas item pass finds an item: a node by live path, or an extra by id. */
interface SortPiece {
  readonly kind: 'node' | 'extra';
  readonly id: string;
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
    tileData: { ...item.tileData!, cells: row.cells, rowOrigin: { ...TRANSFORM2D_IDENTITY, ty: row.y } },
  }));
}

interface FramedItem {
  item: YSortItem;
  frame: PaintFrame;
}

type CollectionRun =
  | { kind: 'layerRows'; entries: FramedItem[] }
  | { kind: 'rootRows'; entry: FramedItem }
  | { kind: 'node'; entry: FramedItem };

/** Whether `item` is a row of a y-sorted layer, which a registered renderer draws. */
function isLayerRow(item: YSortItem): boolean {
  return item.kind === 'tileGroup' && !!item.node && !!nodeComponentRegistry.getYSortGroup(item.node.type);
}

/**
 * The items in collection order with their frames, the rows of one layer gathered into a run. A
 * layer's rows are adjacent in that order (`rowItemsOf`), and the run keeps them below one group.
 * Items without a node draw nothing and are left out.
 */
function inCollectionRuns(
  items: readonly YSortItem[],
  frames: ReadonlyMap<YSortItem, PaintFrame>
): CollectionRun[] {
  const runs: CollectionRun[] = [];
  for (const item of items) {
    if (!item.node) continue;
    const entry = { item, frame: frames.get(item)! };
    const last = runs.at(-1);
    if (!isLayerRow(item)) {
      runs.push({ kind: 'node', entry });
    } else if (item.tileData?.rootsSort) {
      runs.push({ kind: 'rootRows', entry });
    } else if (last?.kind === 'layerRows' && last.entries[0]!.item.treeOrder === item.treeOrder) {
      last.entries.push(entry);
    } else {
      runs.push({ kind: 'layerRows', entries: [entry] });
    }
  }
  return runs;
}

/** One sorted node, dispatched back through the one dispatcher in the frame the sort gave it. */
function NodeItem({ entry: { item, frame }, basePath }: { entry: FramedItem; basePath: string }) {
  const node = item.node!;
  const path = liftedPath(basePath, item.liftedPast, node.name);
  return (
    <PaintFrameProvider value={frame}>
      <LiftedAncestors liftedPast={item.liftedPast} basePath={basePath}>
        <DispatchedNode node={node} path={path} />
      </LiftedAncestors>
    </PaintFrameProvider>
  );
}

/**
 * The rows of the layer that is the sort root. The layer's own component holds its group, so the
 * rows draw below it.
 */
function RootRows({ entry: { item, frame }, basePath }: { entry: FramedItem; basePath: string }) {
  const Renderer = nodeComponentRegistry.getYSortGroup(item.node!.type)!.Renderer;
  const path = liftedPath(basePath, item.liftedPast, item.node!.name);
  return (
    <PaintFrameProvider value={frame}>
      <LiftedAncestors liftedPast={item.liftedPast} basePath={basePath}>
        <NodePathProvider path={path}>
          <Renderer item={item} node={item.node!} />
        </NodePathProvider>
      </LiftedAncestors>
    </PaintFrameProvider>
  );
}

/** The rows of one layer below the layer's group, each at the draw sequence the sort gave it. */
function LayerRows({ entries, basePath }: { entries: readonly FramedItem[]; basePath: string }) {
  const { liftedPast, node } = entries[0]!.item;
  const path = liftedPath(basePath, liftedPast, node!.name);
  const Renderer = nodeComponentRegistry.getYSortGroup(node!.type)!.Renderer;
  return (
    <LiftedAncestors liftedPast={liftedPast} basePath={basePath}>
      <YSortLayerGroup node={node!} path={path}>
        {entries.map(({ item, frame }) => (
          // The row's whole draw position rides its group as one paint sequence. Its meshes order
          // within it by their own `renderOrder`, a batching artifact, not a draw position.
          <PaintFrameProvider key={ySortItemId(item)} value={frame}>
            <NodePathProvider path={path}>
              <Renderer item={item} node={item.node!} />
            </NodePathProvider>
          </PaintFrameProvider>
        ))}
      </YSortLayerGroup>
    </LiftedAncestors>
  );
}
