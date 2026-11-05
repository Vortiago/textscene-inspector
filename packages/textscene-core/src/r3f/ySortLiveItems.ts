/**
 * The sort y of a y-sorted item as the scene draws it now. A mixer writes an animated transform
 * onto the item's THREE group (ADR-0011), so the authored pose the collection pass sorted on goes
 * stale while a clip plays. This reads the poses on the groups instead.
 */

import { Matrix4, type Object3D } from 'three';
import { descendsFromClass } from '../godot/classdb/classBaseTypes.js';
import { pathsAlong } from './liveNodePatches.js';
import { joinPath } from '../utils/nodePath.js';
import type { YSortItem } from './ySortItems.js';

/** The group that draws the node at a scene path, or null while it is not mounted. */
export type GroupAt = (path: string) => Object3D | null;

/** Written only by {@link liveSortY}, which reads it back before it returns. */
const toSortRoot = new Matrix4();

/**
 * The y of `item`'s origin in the sort root's space, from the live group of each node between the
 * sort root and the item. Null where the item has no 2D pose to read: a tile row, whose layer no
 * mixer moves while it is lifted, a Node3D, and a node whose group is not mounted.
 */
export function liveSortY(item: YSortItem, basePath: string, groupAt: GroupAt): number | null {
  const node = item.node;
  if (!node || item.kind !== 'node' || descendsFromClass(node.type, 'Node3D')) return null;
  toSortRoot.identity();
  // The group of each node on the way, outermost first; the common item has no lifted ancestor.
  const paths =
    item.liftedPast.length === 0
      ? [joinPath(basePath, node.name)]
      : pathsAlong([...item.liftedPast, node], basePath);
  for (const path of paths) {
    const group = groupAt(path);
    if (!group) return null;
    if (group.matrixAutoUpdate) group.updateMatrix();
    toSortRoot.multiply(group.matrix);
  }
  // THREE's y runs up where Godot's runs down (`threeMatrixFromTransform2D`).
  return -toSortRoot.elements[13]!;
}
