/**
 * Resolves an AnimationPlayer's `root_node` to the scene path of its animation root, which every
 * track NodePath is read from (ADR-0011). The walk is Godot's `get_node`, so `..` climbs one node
 * and a path above the scene root reaches nothing.
 */

import { resolveRelativePath } from '../../../utils/nodePath';
import { extractNodePathInner } from './animationResolver';

/** `root_node`'s default: the player's parent. */
const DEFAULT_ROOT_NODE = '..';

export function resolveAnimationRootPath(playerPath: string, rootNode: string): string | null {
  const path = rootNode ? (extractNodePathInner(rootNode) ?? rootNode).trim() : DEFAULT_ROOT_NODE;
  return resolveRelativePath(playerPath, path);
}
