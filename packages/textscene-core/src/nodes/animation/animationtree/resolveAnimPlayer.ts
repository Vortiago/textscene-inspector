/**
 * Resolve an AnimationTree's `anim_player` NodePath to the absolute,
 * slash-joined scene-tree path of the driver it targets. Godot relative-path
 * semantics: the path is relative to the tree node, so a leading `..` climbs
 * to the tree's parent. The result keys into the AnimationDriverRegistry to
 * find the GLB animation driver or AnimationPlayer that owns the clips.
 */

import { extractNodePathInner } from '../animationplayer/animationResolver';

export function resolveAnimPlayerPath(
  treeNodePath: string,
  animPlayerRef: string
): string | null {
  const inner = extractNodePathInner(animPlayerRef);
  if (inner === null || inner.length === 0) return null;

  const segments = treeNodePath.split('/').filter((s) => s.length > 0);
  for (const part of inner.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      // segments[0] is the scene root; popping it (length 1) would climb above
      // the scene — unresolvable in a single-scene previewer.
      if (segments.length <= 1) return null;
      segments.pop();
      continue;
    }
    segments.push(part);
  }
  return segments.length > 0 ? segments.join('/') : null;
}
