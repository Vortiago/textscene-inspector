/** Shared descendant-type walk for the physics semantic linters. */

import type { TscnNode } from '../../parser/types.js';

/**
 * True when `node` has a descendant of `type` at any depth — a collision shape
 * under a body, a wheel under a vehicle. Extracted from the physics slice
 * linters that each carried a byte-identical copy differing only in the type
 * literal, so the name stays generic: a rule needing a different child type
 * passes it rather than growing another copy.
 *
 * This searches the whole subtree. A rule that wants Godot's DIRECT-child
 * semantics wants the parent check (`findParentNode`) instead, not this.
 */
export function hasDescendantOfType(node: TscnNode, type: string): boolean {
  for (const child of node.children) {
    if (child.type === type) {
      return true;
    }
    // Check recursively in case the child is nested deeper
    if (hasDescendantOfType(child, type)) {
      return true;
    }
  }
  return false;
}
