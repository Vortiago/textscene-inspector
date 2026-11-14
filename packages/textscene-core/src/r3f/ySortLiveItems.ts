/**
 * The sort y of a y-sorted item as the scene draws it now. A mixer writes an animated transform
 * onto the item's THREE group (ADR-0011), so the authored pose the collection pass sorted on goes
 * stale while a clip plays. This reads the poses on the groups instead.
 */

import { Matrix4, Vector3, type Object3D } from 'three';
import type { Transform2DColumns } from '../godot/math/transform2d.js';
import { descendsFromClass } from '../godot/classdb/classBaseTypes.js';
import { isControlType } from './canvasItemClass.js';
import { pathsAlong } from './liveNodePatches.js';
import type { LiveNode } from '../resources/liveNode.js';
import type { YSortItem } from './ySortItems.js';

/** The group that draws the node at a scene path, or null while it is not mounted. */
export type GroupAt = (path: string) => Object3D | null;

/** Written only by {@link sortYOfChain}, which reads each back before it returns. */
const toSortRoot = new Matrix4();
const rootOrigin = new Vector3();

/**
 * The live group of each node between the sort root and `item`, outermost first. A tile row ends
 * at the group of its layer. Null where the item has no 2D pose to read: the rows of a layer that
 * is the sort root, which sort in the layer's own space, a Node3D, a node whose group is not
 * mounted, and a Control, which the Control walk places and the world walk leaves at the
 * identity. A scene tile's instance and a TileMap's layer register no group, so the chain ends at
 * their parent and {@link liveRootPose} adds the placed pose. A tile with a Control root reads none.
 */
export function liveGroupChain(item: YSortItem, basePath: string, groupAt: GroupAt): Object3D[] | null {
  const node = item.node as LiveNode | undefined;
  if (!node || item.tileData?.rootsSort || descendsFromClass(node.type, 'Node3D')) return null;
  if (isControlType(node.type)) return null;
  if (node.isUnowned && !node.placedPose) return null;
  const paths = pathsAlong(node.isUnowned ? item.liftedPast : [...item.liftedPast, node], basePath);
  const chain: Object3D[] = [];
  for (const path of paths) {
    const group = groupAt(path);
    if (!group) return null;
    chain.push(group);
  }
  return chain;
}

/** Where the sorted origin sits in the last group of the chain: a tile row's origin, or a scene tile's root. */
export function liveRootPose(item: YSortItem): Transform2DColumns | undefined {
  return item.tileData?.rowOrigin ?? (item.node as LiveNode | undefined)?.placedPose;
}

/** The y of the origin that `chain` places in the sort root's space. `rootPose` is a tile row's origin in its layer. */
export function sortYOfChain(chain: readonly Object3D[], rootPose?: Transform2DColumns): number {
  toSortRoot.identity();
  for (const group of chain) {
    if (group.matrixAutoUpdate) group.updateMatrix();
    toSortRoot.multiply(group.matrix);
  }
  // THREE's y runs up where Godot's runs down (`threeMatrixFromTransform2D`).
  if (!rootPose) return -toSortRoot.elements[13]!;
  return -rootOrigin.set(rootPose.tx, -rootPose.ty, 0).applyMatrix4(toSortRoot).y;
}
