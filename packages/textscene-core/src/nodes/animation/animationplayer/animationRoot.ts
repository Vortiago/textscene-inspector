/**
 * Resolves an AnimationPlayer's `root_node` to the THREE object its mixer roots on (ADR-0011).
 * Track NodePaths bind relative to it through THREE.PropertyBinding's subtree search. The dispatcher
 * wraps every node in an unnamed pickable `<group>`, so each `..` climbs to the nearest named
 * ancestor. Only leading `..` segments are followed.
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
    if (segment !== '..') break; // named down-segments are unsupported
    current = nearestNamedAncestor(current);
    if (current === null) return null;
  }
  return current;
}

function extractPath(rootNode: string): string {
  return (extractNodePathInner(rootNode) ?? rootNode).trim();
}

function nearestNamedAncestor(object: Object3D): Object3D | null {
  let node = object.parent;
  while (node && node.name === '') node = node.parent;
  return node ?? null;
}
