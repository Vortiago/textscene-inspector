/**
 * The collection half of the y-sort pass: flattening a y_sort_enabled node's
 * subtree into the list `<YSortDispatcher>` sorts. Pure data — no React, no
 * THREE.
 *
 * It mirrors Godot's `_collect_ysort_children`: a y_sort_enabled child is
 * appended as an item in its OWN right (its pixels draw at its own sort
 * position) and THEN descended into, so its subtree merges into the same flat
 * list behind it. Descending accumulates the child's transform and effective
 * z-index onto everything it lifts out, which is what keeps a merged grandchild
 * drawing where the tree put it rather than at the sort root.
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
  /**
   * Which Y-group of an expanded TileMapLayer this item carries. A Y-group is
   * not a tree position, so it rides here rather than being folded into
   * `treeOrder`: two same-named layers may share a name legally (Godot makes a
   * name unique among its own siblings only), and folding put both on the same
   * identity.
   */
  groupIndex?: number;
}

/**
 * An item's identity within one flat sort — what React keys and THREE object
 * names are built from. Distinct for every item, so a duplicate node name
 * cannot make two of them the same.
 */
export function ySortItemId(item: Pick<YSortItem, 'treeOrder' | 'groupIndex'>): string {
  return item.groupIndex === undefined ? `${item.treeOrder}` : `${item.treeOrder}_${item.groupIndex}`;
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
 *
 * A `top_level` child is not collected at all: it is a canvas root, drawn
 * outside the sort entirely.
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
    // (`renderer_canvas_cull.cpp:110-115`); a top_level item is parented at the
    // canvas instead (`canvas_item.cpp:234-285`), so it is never among them.
    // `<YSortDispatcher>` draws it as the canvas root it is.
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
