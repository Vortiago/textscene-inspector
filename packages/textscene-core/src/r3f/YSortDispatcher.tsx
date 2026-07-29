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
 * The collection mirrors Godot's `_collect_ysort_children`: a y_sort_enabled
 * child is appended as an item in its OWN right (its pixels draw at its own
 * sort position) and THEN descended into, so its subtree merges into the same
 * flat list behind it. Descending accumulates the child's transform and
 * effective z-index onto everything it lifts out, which is what keeps a merged
 * grandchild drawing where the tree put it rather than at the sort root.
 */

import { Fragment, useMemo, type ReactNode } from 'react';
import type { TscnNode } from '../parser/types.js';
import type { Node2DProperties } from '../nodes/base/node2d/types.js';
import { useYSortContext, useYSortSlot, type YSortContextValue } from './contexts/YSortContext.js';
import {
  Modulate2DContext,
  multiplyModulate,
  useCanvasItemTint,
  useParentModulate,
  WHITE_MODULATE,
} from './canvasItemModulate.js';
import { useCanvasItemMaterial } from './components/canvasItemMaterialContext.js';
import { useCanvasModulateFor } from './canvasModulate.js';
import { useCanvasItemLighting } from './lighting2d/useCanvasItemLighting.js';
import {
  EffectiveZProvider,
  accumulateCanvasItemZ,
  useEffectiveZ,
} from './lighting2d/canvasItemPlacement.js';
import { canvasItemBlendState } from '../resources/materials/canvasitemmaterial/renderer.js';
import { CanvasItemBlendMode } from '../resources/materials/canvasitemmaterial/types.js';
import { Z_INDEX_STEP, node2dGroupProps, node2dGroupSpread } from './node2dTransform.js';
import { tileSourceZ } from './tileSourceZ.js';
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
  /**
   * `worldY` is the layer's ACCUMULATED world Y — every y_sort_enabled ancestor
   * this item was lifted past, plus the layer's own `position.y`. The per-row
   * expansion cannot recompute it: by then the only context available is the
   * sort root's, so the ancestors' offsets would silently drop out and the
   * layer's rows would sort against a different origin than its siblings.
   */
  tileData?: { tileSetRef: string; worldY: number; cells?: readonly PlacedCell[] };
  /**
   * The TscnNode to re-dispatch. For a y_sort_enabled node this is its BODY
   * ONLY (`ownBodyOf`): its children are items of their own in this same list,
   * so dispatching the whole node would draw the subtree a second time.
   */
  node?: TscnNode;
  /**
   * The y_sort_enabled ancestors this item was lifted past, outermost first.
   * A merged subtree is re-rendered as a flat sibling list, so their local
   * transforms and path segments have to be restored around the item.
   */
  liftedPast: readonly TscnNode[];
}

/**
 * The node with its subtree removed. A y_sort_enabled node's children are
 * separate entries in the parent's flat sort, so the node itself contributes
 * nothing but its own pixels — which `CanvasItem2D` renders from `body`,
 * independently of the `children` this strips.
 */
function ownBodyOf(node: TscnNode): TscnNode {
  return { ...node, children: [] };
}

/** Compute the sortY and effectiveZ for a single CanvasItem node relative to parent context. */
function itemSortKey(node: TscnNode, parent: YSortContextValue): { sortY: number; effectiveZ: number } {
  const props = node.properties as Record<string, unknown>;
  const localY = (props.position as { y: number } | undefined)?.y ?? 0;
  const ySortOrigin = (props.y_sort_origin as number | undefined) ?? 0;
  const sortY = parent.parentWorldY + localY + ySortOrigin;

  // The SAME accumulation the light cull uses, deliberately: Godot computes it
  // once and reads it twice. `_collect_ysort_children` (renderer_canvas_cull.cpp
  // 160-166) and `_cull_canvas_item` (816-820) both run
  // `CLAMP(p_z + z_index, CANVAS_ITEM_Z_MIN, CANVAS_ITEM_Z_MAX)` under
  // `z_relative` and assign `z_index` unclamped otherwise, so a second copy here
  // could only ever drift from the one the lights are culled against.
  const effectiveZ = accumulateCanvasItemZ(parent.parentEffectiveZ, {
    z_index: (props.z_index as number | undefined) ?? 0,
    z_as_relative: props.z_as_relative as boolean | undefined,
  });
  return { sortY, effectiveZ };
}

/**
 * Collect y-sorted items from a node's children.
 * - y_sort_enabled child TileMapLayer → tileGroup (decomposed by parent).
 * - y_sort_enabled non-TileMapLayer → its own body, then its merged subtree.
 * - Non-y_sort child → single atomic unit.
 *
 * `liftedPast` is the chain of y_sort_enabled ancestors between the sort root
 * and the current level; it grows on every descent and rides each item so the
 * renderer can put back what the flattening took away.
 */
export function collectYSortedItems(
  node: TscnNode,
  parent: YSortContextValue,
  startOrder: number,
  liftedPast: readonly TscnNode[] = []
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
        tileData: {
          tileSetRef: tileProps.tile_set ?? '',
          worldY: parent.parentWorldY + (tileProps.position?.y ?? 0),
        },
        node: child,
        liftedPast,
      });
      continue;
    }

    if (isYSort) {
      // Godot sorts a y_sort_enabled node ALONGSIDE the subtree it merges in —
      // the node is appended first, then descended into. Skipping the append
      // loses the node's own pixels, which is invisible on the container-only
      // nodes that make up most y-sorted trees and total on the rest.
      items.push({
        sortY: key.sortY,
        effectiveZ: key.effectiveZ,
        treeOrder: order++,
        kind: 'node',
        node: ownBodyOf(child),
        liftedPast,
      });
      // Its descendants sort against the child's accumulated position and
      // z-index bucket, not the sort root's — the same `ysort_xform`/`abs_z`
      // Godot threads through the recursion.
      const childLocalY = (props.position as { y: number } | undefined)?.y ?? 0;
      const subItems = collectYSortedItems(
        child,
        { parentWorldY: parent.parentWorldY + childLocalY, parentEffectiveZ: key.effectiveZ },
        order,
        [...liftedPast, child]
      );
      items.push(...subItems);
      order += subItems.length;
    } else {
      items.push({
        sortY: key.sortY,
        effectiveZ: key.effectiveZ,
        treeOrder: order++,
        kind: 'node',
        node: child,
        liftedPast,
      });
    }
  }
  return items;
}

/**
 * Rebuild the local `<group>` transforms of the y_sort_enabled ancestors an
 * item was lifted past, outermost first, around `element`.
 *
 * Deliberately the SAME `node2dGroupProps` conjugation every CanvasItem renders
 * through rather than a composed matrix of its own: `F·M1·F · F·M2·F =
 * F·(M1·M2)·F`, so nesting the groups reproduces the tree's composition exactly
 * (skew included) with no second transform path to keep in step.
 */
function LiftedAncestors({
  liftedPast,
  children,
}: {
  liftedPast: readonly TscnNode[];
  children: ReactNode;
}) {
  // Flattening drops the ancestors' CanvasItem state along with their groups.
  // `visible` and `modulate` both inherit down the tree in Godot, so an
  // invisible or tinted y-sorted container has to keep hiding/tinting the
  // descendants that were lifted out of it — otherwise half a subtree takes the
  // tint (the ancestor's own body still goes through CanvasItem2D) and half
  // does not.
  const parentModulate = useParentModulate();
  // The same goes for the z the lights are culled against: `z_index` accumulates
  // down the tree, so an item lifted out of two nested containers has to be told
  // what those containers contributed before it adds its own.
  const parentEffectiveZ = useEffectiveZ();
  const liftedZ = liftedPast.reduce((z, ancestor) => {
    const props = ancestor.properties as Partial<Node2DProperties>;
    return accumulateCanvasItemZ(z, {
      z_index: props.z_index ?? 0,
      z_as_relative: props.z_as_relative,
    });
  }, parentEffectiveZ);

  let wrapped = children;
  for (let i = liftedPast.length - 1; i >= 0; i--) {
    const ancestor = liftedPast[i]!;
    const props = ancestor.properties as Partial<Node2DProperties>;
    const spread = node2dGroupSpread(
      node2dGroupProps({
        position: props.position ?? { x: 0, y: 0 },
        rotation: props.rotation ?? 0,
        scale: props.scale ?? { x: 1, y: 1 },
        skew: props.skew,
      })
    );
    wrapped = (
      <group {...spread} visible={props.visible !== false}>
        {wrapped}
      </group>
    );
  }

  // `modulate` inherits; `self_modulate` does not, so only the former is folded
  // in here. Applied outside the groups because it is a colour, not a transform.
  const inherited = liftedPast.reduce(
    (acc, a) => multiplyModulate(acc, (a.properties as Partial<Node2DProperties>).modulate ?? WHITE_MODULATE),
    parentModulate
  );

  return (
    <Modulate2DContext.Provider value={inherited}>
      <EffectiveZProvider value={liftedZ}>{wrapped}</EffectiveZProvider>
    </Modulate2DContext.Provider>
  );
}

/** The item's true path in the scene tree, including the levels it was lifted past. */
function liftedPath(basePath: string, liftedPast: readonly TscnNode[], name: string): string {
  return joinPath(liftedPast.reduce((p, a) => joinPath(p, a.name), basePath), name);
}

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


/** Render a TileMapLayer Y-group as TileSourceMeshes at draw position `z`. */
function TileGroupRenderer({ item, z, band, node }: {
  item: YSortItem;
  /** The Y-group's full draw position (z-index bucket + y-sort rank), carried by the group. */
  z: number;
  /** Gap to the next rank — the room this group's atlas sources may use. */
  band: number;
  node: TscnNode;
}): ReactNode | null {
  const tileProps = node.properties as TileMapLayerProperties;
  const { model, status } = useTileSetModel(tileProps.tile_set);
  // A y-sorted layer is decomposed into per-Y groups here instead of rendering
  // through <TileMapLayer>, so its CanvasItem tint has to be resolved here too —
  // the same `useCanvasItemTint` the component's body receives. Hardcoding white
  // left y-sorted tiles as the only 2D drawable a modulate could not reach,
  // which showed up as a dungeon whose props took the CanvasModulate and whose
  // stonework did not.
  // This path bypasses <TileMapLayer>, so it reproduces the CanvasItem ritual's
  // material resolution and light-mode-gated canvas tint itself.
  const material = useCanvasItemMaterial(tileProps);
  const canvasModulate = useCanvasModulateFor(material);
  const { color, opacity } = useCanvasItemTint(tileProps, canvasModulate);
  // This path bypasses CanvasItem2D, so the accumulated z the lights are culled
  // against comes from the sort item, which already carries it.
  const lighting = useCanvasItemLighting(material, tileProps.light_mask, item.effectiveZ);
  const allCells = tileProps.cells ?? null;
  // When expanded by the y-sort pass, tileData.cells holds the filtered Y-group cells.
  const cells = item.tileData?.cells ?? allCells;

  // `visible` and `enabled` gate the ordinary path through <CanvasItem2D>'s
  // group and the `props.enabled &&` in the body. This path bypasses both, so
  // without these two a hidden or disabled y-sorted layer drew every tile.
  const drawable =
    tileProps.visible !== false && tileProps.enabled && !!cells?.length && status === 'loaded';

  // The layer's own Node2D offset. <CanvasItem2D> applies it on the ordinary
  // path; this one bypasses it, and `layerWorldY` above already folds
  // `position.y` into the rows' sort keys — so dropping it here drew the whole
  // map offset from where it sorted. Godot's +Y is DOWN, hence the negation.
  const originX = tileProps.position?.x ?? 0;
  const originY = -(tileProps.position?.y ?? 0);

  if (!drawable || !model) {
    return (
      <group
        name={`TileGroup_${node.name}_${item.treeOrder}`}
        position={[originX, originY, z]}
      />
    );
  }

  // Partition cells by source (per-source batching), then render each Y-group.
  // `sourceIndex` is assigned AFTER the filter, so it is the position among the
  // sources this Y-group actually draws. Keeping the tileset-wide index here
  // while passing the drawn-only count to `tileSourceZ` is what let the nudge
  // run past the band.
  const cellsBySource = model.sourceOrder
    .map((sourceId) => ({
      sourceId,
      source: model.sources.get(sourceId)!,
      cells: cells.filter((c) => c.sourceId === sourceId),
    }))
    .filter((entry) => entry.cells.length > 0)
    .map((entry, sourceIndex) => ({ ...entry, sourceIndex }));

  return (
    <group name={`TileGroup_${node.name}_${item.treeOrder}`} position={[originX, originY, z]}>
      {cellsBySource.map(({ sourceId, sourceIndex, source, cells: sourceCells }) => (
        <TileSourceMesh
          key={`${sourceId}_${item.treeOrder}`}
          source={source}
          cells={sourceCells}
          grid={model}
          z={tileSourceZ(sourceIndex, cellsBySource.length, band)}
          color={color}
          opacity={opacity}
          name={node.name}
          blend={canvasItemBlendState(material?.blendMode ?? CanvasItemBlendMode.MIX)}
          lighting={lighting}
        />
      ))}
    </group>
  );
}

// --- Imports needed by components above ---

import { TileSourceMesh } from './TileSourceMesh.js';
import { YSortSlotProvider, YSortZProvider } from './contexts/YSortContext.js';
// Sorted children go back through the ONE dispatcher rather than a second
// renderer here: that is what keeps `instance=` sub-scenes, selection
// registration, hidden-node gating and the workspace split working under
// y-sort without a copy of each that can drift. The reverse edge
// (Node2D → YSortDispatcher) resolves through `nodeComponentRegistry` at
// runtime, so this import introduces no static cycle.
import { DispatchedNode } from './NodeDispatcher.js';
import { useNodePath } from './contexts/NodePathContext.js';
import { joinPath } from '../utils/nodePath.js';
