/**
 * 2D world-transform composition over the live scene tree, so a Camera2D inside
 * an instance composes correctly. Each Node2D local transform is Godot's +Y-down
 * T·R·Skew·S, and a non-2D ancestor contributes identity. The Cameras panel frames
 * the 2D stage with it, without touching live THREE objects.
 */

import type { TscnNode } from '../parser/types';
import { liveNodeChain, type LiveTreeContext } from './liveSceneTree';
import {
  TRANSFORM2D_IDENTITY,
  multiplyTransform2D,
  transform2DFromParts,
  type Transform2DColumns,
} from '../godot/transform2d.js';

/** A live node's Node2D local transform, or the identity for a non-2D node. */
function localTransform(node: TscnNode): Transform2DColumns {
  const props = node.properties as Record<string, unknown> | undefined;
  const position = props?.position as { x: number; y: number } | undefined;
  if (!position || typeof position.x !== 'number') return TRANSFORM2D_IDENTITY;

  const rotation = typeof props?.rotation === 'number' ? (props.rotation as number) : 0;
  const scale = (props?.scale as { x: number; y: number } | undefined) ?? { x: 1, y: 1 };
  const skew = typeof props?.skew === 'number' ? (props.skew as number) : 0;
  return transform2DFromParts(rotation, scale, skew, position);
}

/**
 * The node's world position in Godot pixel space, or null for an unknown path,
 * composed from each collapsed ancestor's Node2D local transform.
 */
export function node2dWorldPosition(
  roots: readonly TscnNode[],
  ctx: LiveTreeContext,
  path: string
): { x: number; y: number } | null {
  const chain = liveNodeChain(path, roots, ctx);
  if (!chain) return null;

  let world = TRANSFORM2D_IDENTITY;
  for (const node of chain) world = multiplyTransform2D(world, localTransform(node));
  return { x: world.tx, y: world.ty };
}
