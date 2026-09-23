/**
 * The collection half of the y-sort pass: it flattens a y_sort_enabled node's
 * subtree into the list `<YSortDispatcher>` sorts, as Godot's
 * `_collect_ysort_children` does. Pure data: no React, no THREE.
 */

import type { TscnNode } from '../parser/types.js';
import type { YSortContextValue } from './contexts/YSortContext.js';
import { isTopLevelItem } from './canvasPaintOrder.js';
import { accumulateCanvasItemZ } from './lighting2d/canvasItemPlacement.js';
import { nodeComponentRegistry } from './NodeComponentRegistry.js';
import type { PlacedCell } from '../nodes/2d/tiles/shared/tileData.js';

/** A renderable item collected by the y-sort pass. */
export interface YSortItem {
  sortY: number;
  effectiveZ: number;
  treeOrder: number;
  kind: 'node' | 'tileGroup';
  /**
   * For 'tileGroup': TileMapLayer tile props. `worldY` is the layer's accumulated
   * world Y, every lifted-past ancestor plus its own `position.y`. The per-row
   * expansion sees only the sort root's context, so it cannot recompute it.
   */
  tileData?: { tileSetRef: string; worldY: number; cells?: readonly PlacedCell[] };
  /**
   * The TscnNode to re-dispatch. For a y_sort_enabled node this is its body only
   * (`ownBodyOf`): its children are items of their own in this list, so the whole
   * node would draw the subtree twice.
   */
  node?: TscnNode;
  /**
   * The y_sort_enabled ancestors this item was lifted past, outermost first.
   * A merged subtree is re-rendered as a flat sibling list, so their local
   * transforms and path segments have to be restored around the item.
   */
  liftedPast: readonly TscnNode[];
  /**
   * Which Y-group of an expanded TileMapLayer this item carries. It is not a tree
   * position, so it stays out of `treeOrder`: two layers may share a name (Godot
   * makes a name unique among siblings only), and folding would merge their identities.
   */
  groupIndex?: number;
}

/**
 * An item's identity within one flat sort, for React keys and THREE object names.
 * Distinct for every item, so a duplicate node name cannot merge two.
 */
export function ySortItemId(item: Pick<YSortItem, 'treeOrder' | 'groupIndex'>): string {
  return item.groupIndex === undefined ? `${item.treeOrder}` : `${item.treeOrder}_${item.groupIndex}`;
}

/**
 * The node with its subtree removed. A y_sort_enabled node's children are separate
 * entries in the flat sort, so the node contributes only its own pixels, which
 * `CanvasItem2D` renders from `body`.
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

  // The same accumulation the light cull uses: `_collect_ysort_children` (renderer_canvas_cull.cpp
  // 160-166) and `_cull_canvas_item` (816-820) both run
  // `CLAMP(p_z + z_index, CANVAS_ITEM_Z_MIN, CANVAS_ITEM_Z_MAX)` under `z_relative`
  // and assign `z_index` unclamped otherwise. A second copy could drift from the lights.
  const effectiveZ = accumulateCanvasItemZ(parent.parentEffectiveZ, {
    z_index: (props.z_index as number | undefined) ?? 0,
    z_as_relative: props.z_as_relative as boolean | undefined,
  });
  return { sortY, effectiveZ };
}

/**
 * Collect y-sorted items from a node's children: a y_sort_enabled TileMapLayer is a
 * tileGroup, another y_sort_enabled child is its own body and then its merged subtree,
 * and any other child is one atomic unit. `liftedPast` is the chain of y_sort_enabled
 * ancestors, so the renderer can restore their transforms and path segments.
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
    // `_collect_ysort_children` walks the RenderingServer's `child_items`
    // (`renderer_canvas_cull.cpp:110-115`). A top_level item is parented at the
    // canvas instead (`canvas_item.cpp:234-285`), so it is never among them.
    // `<YSortDispatcher>` draws it as a canvas root.
    if (isTopLevelItem(child)) continue;
    const key = itemSortKey(child, parent);
    const props = child.properties as Record<string, unknown>;
    const isYSort = props.y_sort_enabled === true;

    const group = isYSort ? nodeComponentRegistry.getYSortGroup(child.type) : undefined;
    if (group && nodeComponentRegistry.isCanvasItem(child.type)) {
      const layer = group.describe(child);
      items.push({
        sortY: key.sortY,
        effectiveZ: key.effectiveZ,
        treeOrder: order++,
        kind: 'tileGroup',
        tileData: {
          tileSetRef: layer.tileSetRef,
          worldY: parent.parentWorldY + layer.positionY,
        },
        node: child,
        liftedPast,
      });
      continue;
    }

    if (isYSort) {
      // Godot sorts a y_sort_enabled node alongside the subtree it merges in: the
      // node is appended first, then descended into. Without the append, the
      // node's own pixels are lost.
      items.push({
        sortY: key.sortY,
        effectiveZ: key.effectiveZ,
        treeOrder: order++,
        kind: 'node',
        node: ownBodyOf(child),
        liftedPast,
      });
      // Its descendants sort against the child's accumulated position and z-index
      // bucket, not the sort root's: Godot threads `ysort_xform` and `abs_z` through.
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
