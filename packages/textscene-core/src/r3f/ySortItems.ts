/**
 * The collection half of the y-sort pass: it flattens a y_sort_enabled node's
 * subtree into the list `<YSortDispatcher>` sorts, as Godot's
 * `_collect_ysort_children` does. Pure data: no React, no THREE.
 */

import type { TscnNode } from '../parser/types.js';
import { isTopLevelItem, ysortsChildren } from './canvasPaintOrder.js';
import { nodeComponentRegistry } from './NodeComponentRegistry.js';
import type { DrawableCell } from '../resources/tileset/drawableCell.js';
import {
  multiplyTransform2D,
  TRANSFORM2D_IDENTITY,
  type Transform2DColumns,
} from '../godot/math/transform2d.js';
import { canvasItemFieldsOf, type CanvasItemNodeFields } from './canvasItemPass/canvasItemFields.js';
import { NO_PATCHES, patchedNode, type NodePatches } from './nodePatch.js';
import { joinPath } from '../utils/nodePath.js';
import { perObject } from '../utils/perObject.js';
import { isControlType } from './canvasItemClass.js';
import type { ControlTransforms } from './contexts/YSortContext.js';

/** What `_collect_ysort_children` threads down to the children of one y-sorted item. */
export interface YSortParent {
  /** `ysort_xform`: the item's transform in the sort root's space (`renderer_canvas_cull.cpp:131`). */
  toSortRoot: Transform2DColumns;
}

/** The sort root's own children, in the root's space. */
export const Y_SORT_ROOT: YSortParent = { toSortRoot: TRANSFORM2D_IDENTITY };

/** A renderable item collected by the y-sort pass. */
export interface YSortItem {
  sortY: number;
  treeOrder: number;
  kind: 'node' | 'tileGroup';
  /**
   * For 'tileGroup': TileMapLayer tile props. `toSortRoot` is the layer's transform in the sort
   * root's space, through every lifted-past ancestor, which places each row's sort y. A row also
   * holds its origin in the layer's space, `rowOrigin`, which the live sort places through the layer's group.
   * `rootsSort` marks the rows of the layer that is the sort root: they sort in its own space, so
   * no pose of the layer moves them.
   */
  tileData?: {
    tileSetRef: string;
    toSortRoot: Transform2DColumns;
    cells?: readonly DrawableCell[];
    rowOrigin?: Transform2DColumns;
    rootsSort?: boolean;
  };
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

/**
 * A child's transform in the sort root's space, `ysort_xform` (`renderer_canvas_cull.cpp:131`).
 * A node that is no CanvasItem, such as a Node3D, has no 2D transform and sits at its parent's. A
 * Control's canvas item sits at `controlTransform`, which the Control walk publishes after its
 * solve, and at the parent's origin until then.
 */
function toSortRootOf(
  fields: CanvasItemNodeFields | null,
  parent: YSortParent,
  controlTransform: Transform2DColumns | undefined
): Transform2DColumns {
  const local = fields ? (fields.local ?? controlTransform) : undefined;
  return local ? multiplyTransform2D(parent.toSortRoot, local) : parent.toSortRoot;
}

/**
 * A child's sort y, the y of its origin in the sort root's space (`renderer_canvas_cull.h:115-123`),
 * and what it threads to its own children: its transform there. A TileMapLayer's
 * `y_sort_origin` moves only its rows (`tile_map_layer.cpp:547`), never the layer's own origin.
 */
function itemSortKey(
  child: TscnNode,
  parent: YSortParent,
  controlTransform: Transform2DColumns | undefined
): YSortParent & { sortY: number } {
  const fields = canvasItemFieldsOf(child);
  const toSortRoot = toSortRootOf(fields, parent, controlTransform);
  return { toSortRoot, sortY: toSortRoot.ty };
}

/** The y-sort group of a y_sort_enabled canvas item that draws per tile row, or undefined. */
function ySortTileGroup(node: TscnNode) {
  if (!ysortsChildren(node)) return undefined;
  const group = nodeComponentRegistry.getYSortGroup(node.type);
  return group && nodeComponentRegistry.isCanvasItem(node.type) ? group : undefined;
}

/**
 * The rows of a y_sort_enabled TileMapLayer that roots its own sort, or null for any other node.
 * Godot lists the rows beside the layer's child nodes (`renderer_canvas_cull.cpp:110-170`), and on
 * a tie in sort y a row draws before a child node, so the item comes first in collection order.
 */
export function collectSortRootRows(node: TscnNode): YSortItem | null {
  const group = ySortTileGroup(node);
  if (!group) return null;
  return {
    sortY: 0,
    treeOrder: 0,
    kind: 'tileGroup',
    tileData: {
      tileSetRef: group.describe(node).tileSetRef,
      toSortRoot: Y_SORT_ROOT.toSortRoot,
      rootsSort: true,
    },
    node: ownBodyOf(group.asRootRows(node)),
    liftedPast: [],
  };
}

/** The live poses the sort reads: the patches below the live path of the node it collects from. */
export interface YSortLivePoses {
  path: string;
  patches: NodePatches;
  /** Where the Control walk put each Control's canvas item in its parent, by path, which a Control child sorts on. */
  controlTransforms?: ControlTransforms;
}

const AUTHORED_POSES: YSortLivePoses = { path: '', patches: NO_PATCHES };

/**
 * Collect y-sorted items from a node's children: a y_sort_enabled TileMapLayer is a
 * tileGroup, another y_sort_enabled child is its own body, each then followed by its merged
 * subtree, and any other child is one atomic unit. `liftedPast` is the chain of y_sort_enabled
 * ancestors, so the renderer can restore their transforms and path segments. The items keep the
 * authored nodes, which the renderer patches itself, and sort on the `live` poses.
 */
export function collectYSortedItems(
  node: TscnNode,
  parent: YSortParent,
  startOrder: number,
  liftedPast: readonly TscnNode[] = [],
  live: YSortLivePoses = AUTHORED_POSES
): YSortItem[] {
  const items: YSortItem[] = [];
  let order = startOrder;

  for (const child of node.children) {
    // `_collect_ysort_children` walks the RenderingServer's `child_items`
    // (`renderer_canvas_cull.cpp:110-115`). A top_level item is parented at the
    // canvas instead (`canvas_item.cpp:234-285`), so it is never among them.
    // `<YSortDispatcher>` draws it as a canvas root.
    if (isTopLevelItem(child)) continue;
    const childPoses = { ...live, path: joinPath(live.path, child.name) };
    // Godot sorts on the transform it draws (`renderer_canvas_cull.cpp:131`), such as the pose a
    // RemoteTransform2D pushes.
    const key = itemSortKey(
      patchedNode(child, live.patches.get(childPoses.path)),
      parent,
      live.controlTransforms?.get(childPoses.path)
    );
    // A y-sorted child, a Control included, merges its own children into this sort.
    const isYSort = ysortsChildren(child);

    const group = ySortTileGroup(child);
    const isTileGroup = group !== undefined;
    items.push({
      sortY: key.sortY,
      treeOrder: order++,
      kind: isTileGroup ? 'tileGroup' : 'node',
      ...(isTileGroup && {
        tileData: { tileSetRef: group.describe(child).tileSetRef, toSortRoot: key.toSortRoot },
      }),
      // A y_sort_enabled node draws only its body: its children are items of their own below.
      node: isYSort && !isTileGroup ? ownBodyOf(child) : child,
      liftedPast,
    });
    if (!isYSort) continue;
    // Godot appends a y_sort_enabled node first, then merges its subtree into this sort. The
    // descendants sort against the child's `ysort_xform` and `abs_z`, not the sort root's.
    const subItems = collectYSortedItems(child, key, order, [...liftedPast, child], childPoses);
    items.push(...subItems);
    order += subItems.length;
  }
  return items;
}

/** Whether `node` or a node below it is a Control, so a Control subtree moves with it. */
export const hasControl: (node: TscnNode) => boolean = perObject(
  (node) => isControlType(node.type) || node.children.some(hasControl)
);
