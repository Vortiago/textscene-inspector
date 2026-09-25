/**
 * 2D world-transform composition over the live scene tree, so a Camera2D inside
 * an instance composes correctly. Each Node2D local transform is Godot's +Y-down
 * T·R·Skew·S, and a non-2D ancestor contributes identity. The Cameras panel frames
 * the 2D stage with it, without touching live THREE objects.
 */

import type { TscnNode } from '../parser/types';
import { liveNodeChain, type LiveTreeContext } from './liveSceneTree';
import { node2DLocalTransform } from './node2dTransform';
import {
  TRANSFORM2D_IDENTITY,
  multiplyTransform2D,
  type Transform2DColumns,
} from '../godot/transform2d.js';

/** A live node's Node2D local transform, or the identity for a node with no 2D position. */
function localTransform(node: TscnNode): Transform2DColumns {
  const props = node.properties as Record<string, unknown> | undefined;
  const position = props?.position as { x: number; y: number } | undefined;
  if (!position || typeof position.x !== 'number') return TRANSFORM2D_IDENTITY;

  // A Node3D also carries a `position`, beside a Vector3 `rotation`: only a number is an angle.
  return node2DLocalTransform({
    position,
    rotation: typeof props?.rotation === 'number' ? props.rotation : undefined,
    scale: props?.scale as { x: number; y: number } | undefined,
    skew: typeof props?.skew === 'number' ? props.skew : undefined,
  });
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
