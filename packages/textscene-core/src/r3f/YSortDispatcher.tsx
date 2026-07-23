/**
 * YSortDispatcher — collects children of a y_sort_enabled node, sorts them
 * by (effectiveZ bucket → sortY → tree order), assigns rank-based z, and
 * re-renders in that order.
 *
 * Operator correction §1: within-bucket rank-based z sub-steps:
 *   z = effectiveZ * Z_INDEX_STEP + ((rank + 1) / (K + 1)) * YSORT_SUBRANGE
 * where YSORT_SUBRANGE < Z_INDEX_STEP (50% of step).
 *
 * This module also exports computeZSortValues for the contract test.
 */

import { useMemo, Fragment, type ReactNode } from 'react';
import type { TscnNode } from '../parser/types.js';
import * as THREE from 'three';
import { useYSortContext, type YSortContextValue } from './contexts/YSortContext.js';
import { Z_INDEX_STEP, TILE_SOURCE_STEP } from './node2dTransform.js';
import { nodeComponentRegistry } from './NodeComponentRegistry.js';
import type { TileMapLayerProperties } from '../nodes/2d/tiles/tilemaplayer/types.js';
import { useTileSetModel } from './useTileSetModel.js';

/** Z sub-range for y-sort ranks within one z-index bucket (50% of Z_INDEX_STEP). */
const YSORT_SUBRANGE = Z_INDEX_STEP * 0.5;

/** A renderable item collected by the y-sort pass. */
export interface YSortItem {
  sortY: number;
  effectiveZ: number;
  treeOrder: number;
  kind: 'node' | 'tileGroup';
  /** For 'tileGroup': TileMapLayer tile props. */
  tileData?: { tileSetRef: string; worldY: number };
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
 * Compute sorted z-offsets for children of a y_sort_enabled node.
 * Pure function, called from the contract test to verify the sort algorithm.
 */
export function computeZSortValues(
  node: TscnNode,
  parentWorldY: number
): Array<{ name: string; sortY: number; z: number }> {
  const parent: YSortContextValue = {
    parentWorldY,
    parentEffectiveZ: 0,
    insideYSort: false,
    depth: 0,
  };
  const items = collectYSortedItems(node, parent, 0);

  // Sort: bucket by effectiveZ ascending, then by sortY ascending (stable sort).
  const sorted = [...items]
    .sort((a, b) => {
      if (a.effectiveZ !== b.effectiveZ) return a.effectiveZ - b.effectiveZ;
      return a.sortY - b.sortY;
    });

  // Assign z based on rank within each bucket.
  const result: Array<{ name: string; sortY: number; z: number }> = [];
  const buckets = new Map<number, typeof sorted>();
  for (const item of sorted) {
    const bucket = buckets.get(item.effectiveZ);
    if (bucket) bucket.push(item);
    else buckets.set(item.effectiveZ, [item]);
  }
  const bucketKeys = [...buckets.keys()].sort((a, b) => a - b);
  for (const effZ of bucketKeys) {
    const bucket = buckets.get(effZ)!;
    for (let g = 0; g < bucket.length; g++) {
      const item = bucket[g]!;
      const K = bucket.length;
      const sortZ = ((g + 1) / (K + 1)) * YSORT_SUBRANGE;
      const z = item.effectiveZ * Z_INDEX_STEP + sortZ;
      result.push({
        name: item.kind === 'tileGroup'
          ? `tilegroup:${item.tileData!.tileSetRef}`
          : `node:${item.treeOrder}`,
        sortY: item.sortY,
        z,
      });
    }
  }
  return result;
}

/**
 * <YSortDispatcher> — the component that performs the y-sort pass on a
 * y_sort_enabled Node2D's children.
 */
export function YSortDispatcher({ node, children: _children }: { node: TscnNode; children: ReactNode }) {
  const parent = useYSortContext();

  // Collect and sort.
  const items = useMemo(() => collectYSortedItems(node, parent, 0), [node, parent]);

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
    <YSortCollectingProvider value={true}>
      {sorted.map(({ item, rank }) => {
        const sameBucket = sorted.filter(s => s.item.effectiveZ === item.effectiveZ);
        const K = sameBucket.length;
        const sortZ = ((rank + 1) / (K + 1)) * YSORT_SUBRANGE;
        const fullZ = item.effectiveZ * Z_INDEX_STEP + sortZ;

        if (item.kind === 'tileGroup' && item.node) {
          return (
            <YSortZProvider key={item.treeOrder} value={fullZ}>
              <TileGroupRenderer item={item} sortZ={sortZ} node={item.node} />
            </YSortZProvider>
          );
        }

        if (item.node) {
          return (
            <YSortZProvider key={`${item.treeOrder}`} value={fullZ}>
              <YSortChild node={item.node} path={node.name} />
            </YSortZProvider>
          );
        }
        return null;
      })}
    </YSortCollectingProvider>
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
    children.push(<Fragment key="__inline">{inlineChildren}</Fragment>);
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

/** Render a TileMapLayer Y-group as TileSourceMeshes. */
function TileGroupRenderer({ item, sortZ, node }: {
  item: YSortItem;
  sortZ: number;
  node: TscnNode;
}): ReactNode | null {
  const tileProps = node.properties as TileMapLayerProperties;
  const { model, status } = useTileSetModel(tileProps.tile_set);
  const cells = tileProps.cells ?? null;

  if (!cells?.length || status !== 'loaded' || !model) {
    return <group name={`TileGroup_${node.name}_${item.treeOrder}`} position={[0, 0, sortZ]} />;
  }

  // Partition cells by source (per-source batching), then render each Y-group.
  const cellsBySource = model.sourceOrder.map((sourceId, sourceIdx) => ({
    sourceId,
    sourceIndex: sourceIdx,
    source: model.sources.get(sourceId)!,
    cells: cells.filter((c) => c.sourceId === sourceId),
  })).filter((entry) => entry.cells.length > 0);

  return (
    <group name={`TileGroup_${node.name}_${item.treeOrder}`} position={[0, 0, sortZ]}>
      {cellsBySource.map(({ sourceId, sourceIndex, source, cells: sourceCells }) => (
        <TileSourceMesh
          key={`${sourceId}_${item.treeOrder}`}
          source={source}
          cells={sourceCells}
          grid={model}
          z={sortZ + sourceIndex * TILE_SOURCE_STEP}
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
import { YSortCollectingProvider, YSortZProvider } from './contexts/YSortContext.js';
