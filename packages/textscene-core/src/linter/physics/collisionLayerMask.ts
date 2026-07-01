/** Shared "collision_layer/mask is 0" warnings for the physics body linters. */

import type { Diagnostic } from '../types.js';
import type { TscnNode } from '../../parser/types.js';

/**
 * Push the "collision_layer is 0" / "collision_mask is 0" warnings shared by
 * RigidBody/CharacterBody/StaticBody. (Area gates its own layer/mask checks on
 * `monitoring` and uses different wording, so it is not a caller.)
 */
export function pushZeroCollisionLayerMaskWarnings(
  diagnostics: Diagnostic[],
  node: TscnNode,
  rawProps: Record<string, string>,
  type: string,
  prefix: string
): void {
  // Warning: collision_layer is 0 (body won't be on any layer)
  if (rawProps.collision_layer !== undefined) {
    const collisionLayer = parseInt(rawProps.collision_layer, 10);
    if (!isNaN(collisionLayer) && collisionLayer === 0) {
      diagnostics.push({
        severity: 'warning',
        message: `${type} '${node.name}' has collision_layer set to 0. The body won't be on any collision layer and may not interact with other physics objects.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-zero-collision-layer`,
      });
    }
  }

  // Warning: collision_mask is 0 (body won't collide with anything)
  if (rawProps.collision_mask !== undefined) {
    const collisionMask = parseInt(rawProps.collision_mask, 10);
    if (!isNaN(collisionMask) && collisionMask === 0) {
      diagnostics.push({
        severity: 'warning',
        message: `${type} '${node.name}' has collision_mask set to 0. The body won't collide with any layers and may not detect collisions.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-zero-collision-mask`,
      });
    }
  }
}
