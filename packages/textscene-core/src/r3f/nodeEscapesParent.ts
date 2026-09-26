/**
 * Whether a parsed node starts clear of its parent's transform and visibility, by the rule in
 * `godot/parentSpace.ts`. The mounted scene and the passes that run before anything mounts ask it
 * alike, so both break the chain at the same node.
 */

import type { TscnNode } from '../parser/types.js';
import { isTypeUnknowable } from '../parser/typeUnknowable.js';
import { escapesParentSpace, type SpaceFamily } from '../godot/parentSpace.js';

/**
 * A node whose class this file cannot know stays with its parent. An `instance=` node takes the
 * sub-scene root's class (ADR-0013), and a `.glb` root is a Node3D.
 */
export function nodeEscapesParent(node: TscnNode, parentFamily: SpaceFamily | null): boolean {
  return !isTypeUnknowable(node) && escapesParentSpace(parentFamily, node.type);
}
