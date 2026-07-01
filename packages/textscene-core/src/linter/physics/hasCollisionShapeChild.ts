/** Shared collision-shape walk for the physics semantic linters. */

import type { TscnNode } from '../../parser/types.js';

/**
 * True when `node` has a descendant of `shapeType` (e.g. `CollisionShape2D` or
 * `CollisionShape3D`) at any depth. Extracted from the eight physics slice
 * linters that each carried a byte-identical copy differing only in the shape
 * type literal.
 */
export function hasCollisionShapeChild(node: TscnNode, shapeType: string): boolean {
  for (const child of node.children) {
    if (child.type === shapeType) {
      return true;
    }
    // Check recursively in case collision shapes are nested deeper
    if (hasCollisionShapeChild(child, shapeType)) {
      return true;
    }
  }
  return false;
}
