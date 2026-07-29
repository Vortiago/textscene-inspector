/**
 * Resolves an AnimationPlayer's `root_node` to the THREE object its mixer
 * should be rooted on (ADR-0011). Track NodePaths bind relative to this
 * object via THREE.PropertyBinding's subtree search.
 *
 * The dispatcher wraps every node in an UNNAMED pickable `<group>` whose
 * child component carries `name={node.name}` and the base transform. So
 * "one node up" means "nearest named ancestor", skipping wrappers.
 *
 * Slice-1 supports the common cases `.` (the player itself) and `..` (its
 * parent node). Deeper relative paths return the nearest named ancestor as
 * a best effort.
 */

import type { Object3D } from 'three';
import { extractNodePathInner } from './animationResolver';

export function resolveAnimationRoot(
  playerObject: Object3D,
  rootNode: string
): Object3D | null {
  const path = extractPath(rootNode);

  if (path === '.' || path === '') return playerObject;

  // Each ".." segment climbs to the next named ancestor.
  let current: Object3D | null = playerObject;
  for (const segment of path.split('/')) {
    if (segment !== '..') break; // named down-segments unsupported in slice-1
    current = nearestNamedAncestor(current);
    if (current === null) return null;
  }
  return current;
}

function extractPath(rootNode: string): string {
  return (extractNodePathInner(rootNode) ?? rootNode).trim();
}

/**
 * Climb `hops` named ancestors, for a track NodePath that points above the
 * animation root. THREE.PropertyBinding only searches the mixer root's subtree,
 * so a `../Target` track is reachable only if the mixer is rooted at least that
 * far up; the track name itself stays the bare target name.
 *
 * Returns the highest ancestor reached when the scene runs out before `hops` —
 * a target above the scene root cannot exist, and the remaining tracks still
 * bind against the widest subtree available.
 */
export function climbNamedAncestors(object: Object3D, hops: number): Object3D {
  let current = object;
  for (let i = 0; i < hops; i += 1) {
    const parent = nearestNamedAncestor(current);
    if (parent === null) return current;
    current = parent;
  }
  return current;
}

function nearestNamedAncestor(object: Object3D): Object3D | null {
  let node = object.parent;
  while (node && node.name === '') node = node.parent;
  return node ?? null;
}
