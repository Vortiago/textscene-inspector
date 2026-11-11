/**
 * The sort y of a y-sorted item as the scene draws it now. A mixer writes an animated transform
 * onto the item's THREE group (ADR-0011), so the authored pose the collection pass sorted on goes
 * stale while a clip plays. This reads the poses on the groups instead.
 */

import { Matrix4, Vector3, type Object3D } from 'three';
import { multiplyTransform2D, type Transform2DColumns } from '../godot/math/transform2d.js';
import { descendsFromClass } from '../godot/classdb/classBaseTypes.js';
import { pathsAlong } from './liveNodePatches.js';
import type { LiveNode } from '../resources/liveNode.js';
import type { Node2DLocalTransform } from '../nodes/base/node2d/types.js';
import { node2DLocalTransform } from './node2dTransform.js';
import type { YSortItem } from './ySortItems.js';

/** The group that draws the node at a scene path, or null while it is not mounted. */
export type GroupAt = (path: string) => Object3D | null;

/** Written only by {@link sortYOfChain}, which reads each back before it returns. */
const toSortRoot = new Matrix4();
const rootOrigin = new Vector3();

/**
 * The live group of each node between the sort root and `item`, outermost first. Null where the
 * item has no 2D pose to read: a tile row, whose layer no mixer moves while it is lifted, a
 * Node3D, a Control, whose canvas item the Control walk places and the world walk leaves a
 * placeholder at the identity for, and a node whose group is not mounted. An unowned node, a scene tile's placement, has no
 * group and no mixer: its fixed pose is {@link liveRootPose}.
 */
export function liveGroupChain(item: YSortItem, basePath: string, groupAt: GroupAt): Object3D[] | null {
  const node = item.node;
  if (!node || item.kind !== 'node' || descendsFromClass(node.type, 'Node3D')) return null;
  if (descendsFromClass(node.type, 'Control')) return null;
  const paths = pathsAlong(
    (node as LiveNode).isUnowned ? item.liftedPast : [...item.liftedPast, node],
    basePath
  );
  const chain: Object3D[] = [];
  for (const path of paths) {
    const group = groupAt(path);
    if (!group) return null;
    chain.push(group);
  }
  return chain;
}

/**
 * Where the sorted origin sits in the last group of the chain: a scene tile's placement pose, then
 * its instance root's. Undefined for every other item.
 */
export function liveRootPose(item: YSortItem): Transform2DColumns | undefined {
  const node = item.node as LiveNode | undefined;
  if (!node?.isUnowned) return node?.ySortRoot?.pose;
  const placement = node2DLocalTransform(node.properties as Partial<Node2DLocalTransform>);
  return node.ySortRoot ? multiplyTransform2D(placement, node.ySortRoot.pose) : placement;
}

/**
 * The y of the origin that `chain` places in the sort root's space. `rootPose` is where the sorted
 * item's own origin sits in the last group: a scene tile sorts as its instance root.
 */
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
