/**
 * The collection half of the y-sort pass: it flattens a y_sort_enabled node's
 * subtree into the list `<YSortDispatcher>` sorts, as Godot's
 * `_collect_ysort_children` does. Pure data: no React, no THREE.
 */

import type { TscnNode } from '../parser/types.js';
import { isTopLevelItem } from './canvasPaintOrder.js';
import { accumulateCanvasItemZ } from './lighting2d/canvasItemPlacement.js';
import { nodeComponentRegistry } from './NodeComponentRegistry.js';
import type { DrawableCell } from '../resources/tileset/drawableCell.js';
import {
  multiplyTransform2D,
  TRANSFORM2D_IDENTITY,
  type Transform2DColumns,
} from '../godot/math/transform2d.js';
import { node2DLocalTransform } from './node2dTransform.js';
import type { Node2DLocalTransform } from '../nodes/base/node2d/types.js';
import { descendsFromClass } from '../godot/classdb/classBaseTypes.js';
import { NO_PATCHES, patchedNode, type NodePatches } from './nodePatch.js';
import { joinPath } from '../utils/nodePath.js';

/** What `_collect_ysort_children` threads down to the children of one y-sorted item. */
export interface YSortParent {
  /** `ysort_xform`: the item's transform in the sort root's space (`renderer_canvas_cull.cpp:131`). */
  toSortRoot: Transform2DColumns;
  /**
   * The z the pass buckets on: `_collect_ysort_children` carries `abs_z` down, and an item sorts
   * only within its bucket. `EffectiveZContext` carries the same `accumulateCanvasItemZ` value on
   * the ordinary walk.
   */
  effectiveZ: number;
}

/**
 * The sort root's own children. The pass starts at 0, not at the ambient z, so a root under a
 * `z_index`'d ancestor buckets from 0: only the relative order of the buckets reaches the draw.
 */
export const Y_SORT_ROOT: YSortParent = { toSortRoot: TRANSFORM2D_IDENTITY, effectiveZ: 0 };

/** A renderable item collected by the y-sort pass. */
export interface YSortItem {
  sortY: number;
  effectiveZ: number;
  treeOrder: number;
  kind: 'node' | 'tileGroup';
  /**
   * For 'tileGroup': TileMapLayer tile props. `toSortRoot` is the layer's transform in the sort
   * root's space, through every lifted-past ancestor, which places each row's sort y.
   */
  tileData?: { tileSetRef: string; toSortRoot: Transform2DColumns; cells?: readonly DrawableCell[] };
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
 * A Node3D child has no 2D transform: its Vector3 `rotation` would make every sort y NaN.
 */
function toSortRootOf(child: TscnNode, parent: YSortParent): Transform2DColumns {
  if (descendsFromClass(child.type, 'Node3D')) return parent.toSortRoot;
  return multiplyTransform2D(
    parent.toSortRoot,
    node2DLocalTransform(child.properties as Partial<Node2DLocalTransform>)
  );
}

/**
 * A child's sort y, the y of its origin in the sort root's space (`renderer_canvas_cull.h:115-123`),
 * and what it threads to its own children: its transform there and its z bucket. A TileMapLayer's
 * `y_sort_origin` moves only its rows (`tile_map_layer.cpp:547`), never the layer's own origin.
 */
function itemSortKey(child: TscnNode, parent: YSortParent): YSortParent & { sortY: number } {
  const props = child.properties as Record<string, unknown>;
  const toSortRoot = toSortRootOf(child, parent);
  const sortY = toSortRoot.ty;

  // The same accumulation the light cull uses: `_collect_ysort_children` (renderer_canvas_cull.cpp
  // 143-148) and `_cull_canvas_item` (430-434) both run
  // `CLAMP(p_z + z_index, CANVAS_ITEM_Z_MIN, CANVAS_ITEM_Z_MAX)` under `z_relative`
  // and assign `z_index` unclamped otherwise. A second copy could drift from the lights.
  const effectiveZ = accumulateCanvasItemZ(parent.effectiveZ, {
    z_index: (props.z_index as number | undefined) ?? 0,
    z_as_relative: props.z_as_relative as boolean | undefined,
  });
  return { toSortRoot, sortY, effectiveZ };
}

/** The live poses the sort reads: the patches below the live path of the node it collects from. */
export interface YSortLivePoses {
  path: string;
  patches: NodePatches;
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
    const childPoses = { path: joinPath(live.path, child.name), patches: live.patches };
    // Godot sorts on the transform it draws (`renderer_canvas_cull.cpp:131`), such as the pose a
    // RemoteTransform2D pushes.
    const key = itemSortKey(patchedNode(child, live.patches.get(childPoses.path)), parent);
    const props = child.properties as Record<string, unknown>;
    const isYSort = props.y_sort_enabled === true;

    const group = isYSort ? nodeComponentRegistry.getYSortGroup(child.type) : undefined;
    const isTileGroup = group !== undefined && nodeComponentRegistry.isCanvasItem(child.type);
    items.push({
      sortY: key.sortY,
      effectiveZ: key.effectiveZ,
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
