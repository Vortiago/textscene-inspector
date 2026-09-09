/**
 * Resolve an AnimationTree's `anim_player` NodePath to the absolute,
 * slash-joined scene-tree path of the driver it targets. The result keys into
 * the AnimationDriverRegistry to find the GLB animation driver or
 * AnimationPlayer that owns the clips.
 */

import { extractNodePathInner } from '../animationplayer/animationResolver';
import { resolveRelativePath } from '../../../utils/nodePath';

export function resolveAnimPlayerPath(
  treeNodePath: string,
  animPlayerRef: string
): string | null {
  // Unwrapped here rather than through `resolveNodePathLiteral`: that helper
  // reads text it cannot parse as a bare path, while a property holding
  // anything but a `NodePath(…)` literal names no driver at all.
  const inner = extractNodePathInner(animPlayerRef);
  if (inner === null || inner.length === 0) return null;
  // The path is relative to the tree node itself, so a leading `..` climbs to
  // the tree's parent and one from a root-level tree climbs above the scene.
  return resolveRelativePath(treeNodePath, inner);
}
