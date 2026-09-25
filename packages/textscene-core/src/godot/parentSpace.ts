/**
 * Which parent passes its transform and visibility to a child. Godot links a node to its parent for
 * both only within one class family, through a cast that fails across families: Node3D keeps
 * `Object::cast_to<Node3D>(get_parent())` (`node_3d.cpp:150`) and composes its global transform
 * (`:656-660`) and visibility (`:1132-1143`) through it, and CanvasItem does the same through
 * `Object::cast_to<CanvasItem>(parent)` (`canvas_item.cpp:311-314`, `:565-571`).
 */

import { descendsFrom } from './nodeBaseTypes.js';

/** A class family whose parent link carries a transform and visibility. */
export type SpaceFamily = 'Node3D' | 'CanvasItem';

/** The family `nodeType` belongs to, or `null` for a class that carries neither, such as `Node`. */
export function spaceFamilyOf(nodeType: string): SpaceFamily | null {
  if (descendsFrom(nodeType, 'Node3D')) return 'Node3D';
  if (descendsFrom(nodeType, 'CanvasItem')) return 'CanvasItem';
  return null;
}

/**
 * Whether a child of a parent in `parentFamily` starts clear of that parent's transform and
 * visibility. Only a parent in a family has anything to pass on, and only a child of the same family
 * takes it. A CanvasItem below any other parent reads its visibility from a CanvasLayer parent or
 * the Window (`canvas_item.cpp:319-348`).
 */
export function escapesParentSpace(parentFamily: SpaceFamily | null, childType: string): boolean {
  return parentFamily !== null && spaceFamilyOf(childType) !== parentFamily;
}
