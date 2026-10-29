/**
 * A node's 2D world position over the live scene tree, so a Camera2D inside an
 * instance composes against the instance transform. The Cameras panel frames the
 * 2D stage with it, without touching live THREE objects.
 */

import type { RawNode, TscnNode } from '../parser/types';
import { liveNodeChain, type LiveTreeContext } from './liveSceneTree';
import { NO_PATCHES, type NodePatches } from './nodePatch';
import { parentLookup, type ParentLookup } from '../linter/parentType.js';
import { resolveGlobalTransform2D, type Node2DPose } from '../nodes/canvasitem/shared/globalTransform2D.js';

/**
 * The parent lookup over a live chain, root first. A collapsed instance carries its
 * sub-scene root's type, so only an instance whose scene is not cached stays opaque.
 */
function chainParentOf(chain: readonly RawNode[]): (child: RawNode) => ParentLookup {
  const parents = new Map(chain.slice(1).map((child, i): [RawNode, RawNode] => [child, chain[i]!]));
  return (child) => parentLookup(parents.get(child));
}

/** The pose each node of `chain`, which ends at the live path `path`, takes from the patches in `placed`. */
function posesAlong(chain: readonly RawNode[], path: string, placed: NodePatches): Map<RawNode, Node2DPose> {
  const names = path.split('/');
  const poses = new Map<RawNode, Node2DPose>();
  chain.forEach((node, index) => {
    const patch = placed.get(names.slice(0, index + 1).join('/'));
    if (patch) poses.set(node, patch as Node2DPose);
  });
  return poses;
}

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
  placed: NodePatches = NO_PATCHES
): { x: number; y: number } | null {
  const chain = liveNodeChain(path, roots, ctx);
  if (!chain) return null;

  const verdict = resolveGlobalTransform2D(
    chain[chain.length - 1]!,
    chainParentOf(chain),
    posesAlong(chain, path, placed)
  );
  if (verdict.kind === 'unknowable') return null;
  return { x: verdict.transform.tx, y: verdict.transform.ty };
}
