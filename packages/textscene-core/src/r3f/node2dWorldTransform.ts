/**
 * A node's 2D world position over the live scene tree, so a Camera2D inside an
 * instance composes against the instance transform. The Cameras panel frames the
 * 2D stage with it, without touching live THREE objects.
 */

import type { TscnNode } from '../parser/types';
import { liveNodeChain, type LiveTreeContext } from './liveSceneTree';
import { NO_PATCHES, type PatchLookup } from './nodePatch';
import { transform2DOrigin } from '../godot/math/transform2d.js';
import { resolveGlobalTransform2D } from '../nodes/canvasitem/shared/globalTransform2D.js';
import { chainParentOf, posesAlong } from './liveTransform2D.js';

/**
 * The node's world position in Godot pixel space, through Godot's canvas parent
 * chain. Null for an unknown path, and for a chain this cannot decode: an opaque
 * ancestor, or a Control between the node and the top of its chain. `placed` holds the poses the
 * live scene passes bound.
 */
export function node2dWorldPosition(
  roots: readonly TscnNode[],
  ctx: LiveTreeContext,
  path: string,
  placed: PatchLookup = NO_PATCHES
): { x: number; y: number } | null {
  const chain = liveNodeChain(path, roots, ctx);
  if (!chain) return null;

  const verdict = resolveGlobalTransform2D(
    chain[chain.length - 1]!,
    chainParentOf(chain),
    posesAlong(chain, path, placed)
  );
  if (verdict.kind === 'unknowable') return null;
  return transform2DOrigin(verdict.transform);
}
