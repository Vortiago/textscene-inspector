/**
 * A light's place in the canvas light list, its draw order: Godot applies lights in attach order,
 * the preorder walk, and MIX depends on the order. The stencil ordinal cannot serve, as it follows
 * cookie load order and is reused on unmount. The walk reads the live tree, since
 * `YSortDispatcher` mounts in sort order and Godot ranks by tree position.
 */

import type { TscnNode } from '../../parser/types.js';

/**
 * Canvas lights that take a slot in the light list. `DirectionalLight2D` has no cookie quad in
 * this pass, so it takes no slot and no sequence number.
 */
const POSITIONAL_LIGHT_TYPES = new Set(['PointLight2D']);

/** True for a node that occupies a slot in the canvas light list. */
export function isPositionalCanvasLight(node: TscnNode): boolean {
  return POSITIONAL_LIGHT_TYPES.has(node.type);
}
