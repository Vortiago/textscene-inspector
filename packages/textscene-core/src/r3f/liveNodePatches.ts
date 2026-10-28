/**
 * The live scene passes that lay property values over nodes (ADR-0060): the RemoteTransform pass
 * moves its targets, then the CSGPolygon3D pass resolves its paths over the moved nodes. Render, the
 * CSG plan, the inspector and the Control layout read a node through these patches, since a
 * sub-scene's nodes are shared by every instance and a pass cannot write into one.
 */

import { useMemo } from 'react';
import type { TscnNode } from '../parser/types.js';
import { descendsFromClass } from '../godot/classdb/classBaseTypes.js';
import { applyRemoteTransforms } from '../nodes/3d/remotetransform3d/remoteTransforms.js';
import { resolveCsgPolygonPaths } from '../nodes/3d/csg/csgpolygon3d/csgPolygonPaths.js';
import { sameEntries } from '../utils/sameEntries.js';
import { sameData } from '../utils/sameData.js';
import { perObject } from '../utils/perObject.js';
import type { LiveTree } from './liveSceneTree.js';
import { useLiveScenePass, useLiveScenePassSelection, type LiveScenePass } from './liveScenePass.js';
import { NO_PATCHES, patchedNode, type NodePatch, type NodePatches } from './nodePatch.js';

/**
 * Written only by {@link keptPatches}: the previous patch of each node of the live tree, at each
 * live path. A sub-scene's node sits at every instance of it, so the path keys the entry. The
 * entries clear when nothing holds the node any more.
 */
const previousPatches = perObject(() => new Map<string, NodePatch>());

/**
 * `patches`, each one replaced by the patch the node had before where the two hold the same
 * content, so a load that leaves a result as it was hands back the same patch. A node that
 * keeps its patch does not draw again.
 */
function keptPatches(tree: LiveTree, patches: Map<string, NodePatch>): NodePatches {
  for (const [path, patch] of patches) {
    const node = tree.at(path)?.step.node;
    if (!node) continue;
    const previous = previousPatches(node);
    const kept = previous.get(path);
    if (kept && sameData(kept, patch)) patches.set(path, kept);
    else previous.set(path, patch);
  }
  return patches;
}

/** `first` with `second` laid over it, a node that both patch taking the properties of both. */
function mergedPatches(first: NodePatches, second: NodePatches): Map<string, NodePatch> {
  const merged = new Map(first);
  for (const [path, patch] of second) merged.set(path, { ...merged.get(path), ...patch });
  return merged;
}

/**
 * Every patch of `tree`. The RemoteTransform pass runs before the CSGPolygon3D path pass, since a
 * path reads where the nodes ended up.
 */
export const liveNodePatches: LiveScenePass<NodePatch> = (tree) => {
  const transforms = applyRemoteTransforms(tree);
  return keptPatches(tree, mergedPatches(transforms, resolveCsgPolygonPaths(tree, transforms)));
};

/**
 * Whether a node of `type` can take a patch: a RemoteTransform3D drives a Node3D, a
 * RemoteTransform2D a Node2D (`remote_transform_3d.cpp:54`), and the path pass patches a
 * CSGPolygon3D, which is a Node3D.
 */
function canTakePatch(type: string): boolean {
  let can = canTakeByType.get(type);
  if (can === undefined) {
    can = descendsFromClass(type, 'Node3D') || descendsFromClass(type, 'Node2D');
    canTakeByType.set(type, can);
  }
  return can;
}

/** {@link canTakePatch} by type, since each node asks on every render. Written only by it. */
const canTakeByType = new Map<string, boolean>();

/**
 * `node` as the live passes bind it at the live path `path`, and the same node where none does. A
 * null node or path, or a node that cannot take a patch, asks nothing, so it watches no load.
 */
export function useLivePatchedNode<N extends TscnNode | null>(node: N, path: string | null): N {
  const patch = useLiveScenePass(liveNodePatches, node && canTakePatch(node.type) ? path : null);
  return useMemo(() => (node ? patchedNode(node, patch) : node), [node, patch]);
}

/** The patches of the nodes below the live path `path`, for a reader that walks a subtree itself. */
function patchesBelow(patches: NodePatches, path: string): NodePatches {
  if (patches.size === 0) return NO_PATCHES;
  const below = new Map<string, NodePatch>();
  for (const [patchPath, patch] of patches) {
    if (patchPath.startsWith(`${path}/`)) below.set(patchPath, patch);
  }
  return below;
}

/**
 * The patches of the nodes below `path`, by their live paths. A null path asks nothing. A load
 * re-renders the reader only where it changes one of them.
 */
export function useLivePatchesBelow(path: string | null): NodePatches {
  const select = useMemo(
    () => (path === null ? null : (patches: NodePatches) => patchesBelow(patches, path)),
    [path]
  );
  return useLiveScenePassSelection(liveNodePatches, select, sameEntries) ?? NO_PATCHES;
}
