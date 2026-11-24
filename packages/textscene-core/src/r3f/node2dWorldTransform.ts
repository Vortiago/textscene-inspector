/**
 * A node's 2D world position over the live scene tree, so a Camera2D inside an
 * instance composes against the instance transform. The Cameras panel frames the
 * 2D stage with it, without touching live THREE objects.
 */

import type { TscnNode } from '../parser/types';
import { liveNodeChain, type LiveTreeContext } from './liveSceneTree';
import { NO_PATCHES, type PatchLookup } from './nodePatch';
import { transform2DOrigin, type Transform2DColumns } from '../godot/math/transform2d.js';
import { resolveGlobalTransform2D } from '../nodes/canvasitem/shared/globalTransform2D.js';
import { chainParentOf, posesAlong, solvedControlsAlong } from './liveTransform2D.js';

/** Null for an unknown path, an opaque ancestor, or an unsolved Control in the chain. */
export function node2dWorldTransform(
  roots: readonly TscnNode[],
  ctx: LiveTreeContext,
  path: string,
  placed: PatchLookup = NO_PATCHES
): Transform2DColumns | null {
  const chain = liveNodeChain(path, roots, ctx);
  if (!chain) return null;

  const verdict = resolveGlobalTransform2D(
    chain[chain.length - 1]!,
    chainParentOf(chain),
    posesAlong(chain, path, placed),
    solvedControlsAlong(chain, path, ctx.controlTransforms)
  );
  return verdict.kind === 'unknowable' ? null : verdict.transform;
}

/** The origin of {@link node2dWorldTransform}. */
export function node2dWorldPosition(
  roots: readonly TscnNode[],
  ctx: LiveTreeContext,
  path: string,
  placed: PatchLookup = NO_PATCHES
): { x: number; y: number } | null {
  const transform = node2dWorldTransform(roots, ctx, path, placed);
  return transform && transform2DOrigin(transform);
}
