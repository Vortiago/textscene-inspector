/**
 * Resolves an AnimationPlayer's `root_node`, and each Track from it, to scene paths (ADR-0011). Both
 * walk as `get_node_or_null` does: `_update_caches` reads the root from the player
 * (animation_mixer.cpp:661) and each Track from that root (:714). A `%Name` segment reads the
 * owner's unique-name table.
 */

import { resolveRelativePath } from '../../../utils/nodePath';
import { extractNodePathInner } from './animationResolver';

/**
 * The Animation root's scene path, or `null` when `root_node` reaches nothing. An empty path does:
 * `get_node_or_null` refuses it (node.cpp:1894), and the mixer then builds no caches
 * (animation_mixer.cpp:662-666). The parser supplies the `NodePath("..")` default for an absent
 * property.
 */
export function resolveAnimationRootPath(
  playerPath: string,
  rootNode: string,
  uniquePaths?: ReadonlyMap<string, string>
): string | null {
  const path = (extractNodePathInner(rootNode) ?? rootNode).trim();
  if (path === '') return null;
  return resolveRelativePath(playerPath, path, uniquePaths);
}

/** A Track's target as a scene path, or `null` when the walk reaches nothing. */
export function resolveTrackScenePath(
  rootPath: string,
  targetPath: string,
  uniquePaths?: ReadonlyMap<string, string>
): string | null {
  return resolveRelativePath(rootPath, targetPath, uniquePaths);
}
