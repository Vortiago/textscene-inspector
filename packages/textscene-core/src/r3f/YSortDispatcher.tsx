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
 */

import { useMemo, type ReactNode } from 'react';
import type { TscnNode } from '../parser/types.js';
import * as THREE from 'three';
import { useYSortContext, useYSortSlot, type YSortContextValue } from './contexts/YSortContext.js';
import { Z_INDEX_STEP, TILE_SOURCE_STEP, YSORT_FINE_RANGE } from './node2dTransform.js';
import { nodeComponentRegistry } from './NodeComponentRegistry.js';
import type { TileMapLayerProperties } from '../nodes/2d/tiles/tilemaplayer/types.js';
import type { PlacedCell } from '../nodes/2d/tiles/shared/tileData.js';
import { useTileSetModel } from './useTileSetModel.js';
import { groupBySortY } from '../resources/tileset/tileYSort.js';
import type { YSortGroup } from '../resources/tileset/tileYSort.js';

/** A renderable item collected by the y-sort pass. */
export interface YSortItem {
  sortY: number;
  effectiveZ: number;
  treeOrder: number;
  kind: 'node' | 'tileGroup';
  /** For 'tileGroup': TileMapLayer tile props. */
  tileData?: { tileSetRef: string; worldY: number; cells?: readonly PlacedCell[] };
  /** The raw TscnNode for this item (used to re-dispatch it). */
  node?: TscnNode;
}

/** Compute the sortY and effectiveZ for a single CanvasItem node relative to parent context. */
function itemSortKey(node: TscnNode, parent: YSortContextValue): { sortY: number; effectiveZ: number } {
  const props = node.properties as Record<string, unknown>;
  const localY = (props.position as { y: number } | undefined)?.y ?? 0;
  const ySortOrigin = (props.y_sort_origin as number | undefined) ?? 0;
  const sortY = parent.parentWorldY + localY + ySortOrigin;

  const zIndex = (props.z_index as number | undefined) ?? 0;
  const zAsRelative = (props.z_as_relative as boolean | undefined);
  const effectiveZ = zAsRelative !== false
    ? parent.parentEffectiveZ + zIndex
    : zIndex;
  return { sortY, effectiveZ };
}

/**
 * Collect y-sorted items from a node's children.
 * - y_sort_enabled child TileMapLayer → tileGroup (decomposed by parent).
 * - y_sort_enabled non-TileMapLayer → recurse.
 * - Non-y_sort child → single atomic unit.
 */
export function collectYSortedItems(
  node: TscnNode,
  parent: YSortContextValue,
  startOrder: number
): YSortItem[] {
  const items: YSortItem[] = [];
  let order = startOrder;

  for (const child of node.children) {
    const key = itemSortKey(child, parent);
    const props = child.properties as Record<string, unknown>;
    const isYSort = props.y_sort_enabled === true;

    if (isYSort && child.type === 'TileMapLayer' && nodeComponentRegistry.isCanvasItem(child.type)) {
      const tileProps = child.properties as TileMapLayerProperties;
      items.push({
        sortY: key.sortY,
        effectiveZ: key.effectiveZ,
        treeOrder: order++,
        kind: 'tileGroup',
        tileData: { tileSetRef: tileProps.tile_set ?? '', worldY: tileProps.position?.y ?? 0 },
        node: child,
      });
      continue;
    }

    if (isYSort) {
      const subItems = collectYSortedItems(child, parent, order);
      items.push(...subItems);
      order += subItems.length;
    } else {
      items.push({ sortY: key.sortY, effectiveZ: key.effectiveZ, treeOrder: order++, kind: 'node', node: child });
    }
  }
  return items;
}

/**
 * <YSortDispatcher> — the component that performs the y-sort pass on a
 * y_sort_enabled Node2D's children.
 */
export function YSortDispatcher({ node, children: _children }: { node: TscnNode; children: ReactNode }) {
  const parent = useYSortContext();
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
          const layerWorldY = parent.parentWorldY + (tp.position?.y ?? 0);
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
            });
          }
          continue;
        }
      }
      expanded.push(item);
    }
    return expanded;
  }, [rawItems, model, status, parent.parentWorldY]);

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

    const result: Array<{ item: YSortItem; rank: number }> = [];
    for (const effZ of [...buckets.keys()].sort((a, b) => a - b)) {
      const bucket = buckets.get(effZ)!;
      for (let g = 0; g < bucket.length; g++) {
        result.push({ item: bucket[g]!, rank: g });
      }
    }
    return result;
  }, [items]);

  return (
    <>
      {sorted.map(({ item, rank }) => {
        const sameBucket = sorted.filter(s => s.item.effectiveZ === item.effectiveZ);
        const K = sameBucket.length;
        const sortZ = ((rank + 1) / (K + 1)) * slot.width;
        const fullZ = item.effectiveZ * Z_INDEX_STEP + sortZ;

        if (item.kind === 'tileGroup' && item.node) {
          // The Y-group's whole draw position (z-index bucket + rank) rides the group;
          // its meshes sit at their own per-source sub-step RELATIVE to it (see the
          // group's `position` below), so the rank is applied ONCE. Key on the layer's
          // name so sibling y-sort TileMapLayers can't collide on a shared treeOrder.
          return (
            <TileGroupRenderer
              key={`tg-${item.node.name}-${item.treeOrder}`}
              item={item}
              z={fullZ}
              node={item.node}
            />
          );
        }

        if (item.node) {
          return (
            <YSortZProvider key={`n-${item.treeOrder}`} value={fullZ}>
              <YSortChild node={item.node} path={node.name} />
            </YSortZProvider>
          );
        }
        return null;
      })}
    </>
  );
}

/** Dispatch a child node through y-sort with its computed z offset. */
function YSortChild({ node, path }: { node: TscnNode; path: string }) {
  const { registerNodeObject, unregisterNodeObject } = useSelection();
  const workspace = useCanvasWorkspace();
  const { hiddenNodePaths } = useSelection();
  const isHidden = hiddenNodePaths.has(path);

  const Component = nodeComponentRegistry.get(node.type) ?? GenericNodeFallback;
  const isCanvasItem = nodeComponentRegistry.isCanvasItem(node.type);
  const isControl = TWO_D_UI_TYPES.has(node.type);

  // In 2D workspace: skip 3D-only nodes.
  if (workspace === '2d' && !isCanvasItem && !isControl && !nodeComponentRegistry.get(node.type)) {
    return null;
  }

  const inlineChildren = node.children.map((child) => (
    <YSortChild key={child.name} node={child} path={`${path}/${child.name}`} />
  ));

  const children: ReactNode[] = [];
  if (inlineChildren.length > 0) {
    // The y-sort rank z is applied to THIS item's group only (via the YSortZProvider
    // wrapping this YSortChild). Its descendants are the atomic unit and render at
    // their own canvasItemZ RELATIVE to this group — reset the rank-z context and the
    // tree-order slot for them, so neither is re-added (which would double-count the
    // rank per nesting level and the slot base per depth).
    children.push(
      <YSortZProvider key="__inline" value={null}>
        <YSortSlotProvider value={{ base: 0, width: YSORT_FINE_RANGE }}>
          {inlineChildren}
        </YSortSlotProvider>
      </YSortZProvider>
    );
  }

  return (
    <group ref={(obj) => {
      if (obj) registerNodeObject(path, obj);
      else unregisterNodeObject(path);
    }} visible={!isHidden}>
      <ErrorBoundary
        resetKeys={[node]}
        fallback={() => (
          <MissingResourcePlaceholder shape="box" name={node.name} />
        )}
      >
        <Component node={node}>
          {children}
        </Component>
      </ErrorBoundary>
    </group>
  );
}

/** Render a TileMapLayer Y-group as TileSourceMeshes at draw position `z`. */
function TileGroupRenderer({ item, z, node }: {
  item: YSortItem;
  /** The Y-group's full draw position (z-index bucket + y-sort rank), carried by the group. */
  z: number;
  node: TscnNode;
}): ReactNode | null {
  const tileProps = node.properties as TileMapLayerProperties;
  const { model, status } = useTileSetModel(tileProps.tile_set);
  const allCells = tileProps.cells ?? null;
  // When expanded by the y-sort pass, tileData.cells holds the filtered Y-group cells.
  const cells = item.tileData?.cells ?? allCells;

  if (!cells?.length || status !== 'loaded' || !model) {
    return <group name={`TileGroup_${node.name}_${item.treeOrder}`} position={[0, 0, z]} />;
  }

  // Partition cells by source (per-source batching), then render each Y-group.
  const cellsBySource = model.sourceOrder.map((sourceId, sourceIdx) => ({
    sourceId,
    sourceIndex: sourceIdx,
    source: model.sources.get(sourceId)!,
    cells: cells.filter((c) => c.sourceId === sourceId),
  })).filter((entry) => entry.cells.length > 0);

  return (
    <group name={`TileGroup_${node.name}_${item.treeOrder}`} position={[0, 0, z]}>
      {cellsBySource.map(({ sourceId, sourceIndex, source, cells: sourceCells }) => (
        <TileSourceMesh
          key={`${sourceId}_${item.treeOrder}`}
          source={source}
          cells={sourceCells}
          grid={model}
          z={sourceIndex * TILE_SOURCE_STEP}
          color={new THREE.Color(1, 1, 1)}
          opacity={1}
          name={node.name}
        />
      ))}
    </group>
  );
}

// --- Imports needed by components above ---

import { GenericNodeFallback } from './internal/generic-node-fallback/index.js';
import { useSelection } from './contexts/SelectionContext.js';
import { useCanvasWorkspace } from './contexts/CanvasWorkspaceContext.js';
import { TWO_D_UI_TYPES } from './controls/has2DUIContent.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { MissingResourcePlaceholder } from './components/MissingResourcePlaceholder.js';
import { TileSourceMesh } from './TileSourceMesh.js';
import { YSortSlotProvider, YSortZProvider } from './contexts/YSortContext.js';
