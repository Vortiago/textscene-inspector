/**
 * The live scene passes that lay property values over nodes (ADR-0060): the RemoteTransform pass
 * moves its targets, then the CSGPolygon3D pass resolves its paths over the moved nodes. The CSG
 * plan, the inspector and the Control layout read a node through these patches, since a sub-scene's
 * nodes are shared by every instance and a pass cannot write into one. Render reads the drawn
 * patches, which also move a mesh that draws behind its node to where Godot draws it.
 */

import { useMemo } from 'react';
import type { TscnNode } from '../parser/types.js';
import { descendsFromClass } from '../godot/classdb/classBaseTypes.js';
import { applyRemoteTransforms, type RelayPoses } from '../nodes/shared/remotetransform/remoteTransforms.js';
import { resolveCsgPolygonPaths } from '../nodes/3d/csg/csgpolygon3d/csgPolygonPaths.js';
import { joinPath } from '../utils/nodePath.js';
import { sameEntries } from '../utils/sameEntries.js';
import { sameData } from '../utils/sameData.js';
import { perObject } from '../utils/perObject.js';
import type { LiveTree } from './liveSceneTree.js';
import {
  liveScenePassResults,
  useLiveScenePass,
  useLiveScenePassSelection,
  type LiveScenePass,
} from './liveScenePass.js';
import { NO_PATCHES, patchedNode, type NodePatch, type NodePatches } from './nodePatch.js';

/** The previous patch of each node of the live tree, at each live path, for one pass. */
type PreviousPatches = (node: TscnNode) => Map<string, NodePatch>;

/**
 * Written only by {@link keptPatches}, one store for each pass. A sub-scene's node sits at every
 * instance of it, so the path keys the entry. The entries clear when nothing holds the node any more.
 */
const previousNodePatches: PreviousPatches = perObject(() => new Map<string, NodePatch>());
const previousDrawnPatches: PreviousPatches = perObject(() => new Map<string, NodePatch>());

/**
 * `patches`, each one replaced by the patch the node had before where the two hold the same
 * content, so a load that leaves a result as it was hands back the same patch. A node that
 * keeps its patch does not draw again.
 */
function keptPatches(
  previousPatches: PreviousPatches,
  tree: LiveTree,
  patches: Map<string, NodePatch>
): NodePatches {
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

/** The RemoteTransform pass over `tree`, run once for both passes below. */
const relayPosesOf = perObject((tree: LiveTree): RelayPoses => applyRemoteTransforms(tree));

/**
 * Every property patch of `tree`. The RemoteTransform pass runs before the CSGPolygon3D path pass,
 * since a path reads where the nodes ended up.
 */
export const liveNodePatches: LiveScenePass<NodePatch> = (tree) => {
  const { placed } = relayPosesOf(tree);
  return keptPatches(previousNodePatches, tree, mergedPatches(placed, resolveCsgPolygonPaths(tree, placed)));
};

/** {@link liveNodePatches} with each mesh that draws behind its node moved to where Godot draws it. */
export const liveDrawnPatches: LiveScenePass<NodePatch> = (tree) => {
  const patches = liveScenePassResults(liveNodePatches, tree);
  const { drawnLag } = relayPosesOf(tree);
  if (drawnLag.size === 0) return patches;
  return keptPatches(previousDrawnPatches, tree, mergedPatches(patches, drawnLag));
};

/** {@link canTakePatch} by type, since each node asks on every render. Written only by it. */
const canTakeByType = new Map<string, boolean>();

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

/**
 * `node` as `pass` binds it at the live path `path`, and the same node where it binds none. A null
 * node or path, or a node that cannot take a patch, asks nothing, so it watches no load.
 */
function useNodeThrough<N extends TscnNode | null>(
  pass: LiveScenePass<NodePatch>,
  node: N,
  path: string | null
): N {
  const patch = useLiveScenePass(pass, node && canTakePatch(node.type) ? path : null);
  return useMemo(() => (node ? patchedNode(node, patch) : node), [node, patch]);
}

/** `node` with the property values the live passes bind at the live path `path`, as the inspector shows it. */
export function useLivePatchedNode<N extends TscnNode | null>(node: N, path: string | null): N {
  return useNodeThrough(liveNodePatches, node, path);
}

/** `node` as render draws it at the live path `path`: {@link liveDrawnPatches} laid over it. */
export function useLiveDrawnNode<N extends TscnNode | null>(node: N, path: string | null): N {
  return useNodeThrough(liveDrawnPatches, node, path);
}

/** The live path of each node of `chain`, a run of nested nodes that starts below `basePath`. */
export function pathsAlong(chain: readonly TscnNode[], basePath: string): string[] {
  const paths: string[] = [];
  let path = basePath;
  for (const node of chain) paths.push((path = joinPath(path, node.name)));
  return paths;
}

/**
 * `chain` as render draws it, a run of nested nodes that starts below the live path `basePath`.
 * One subscription serves the run, and an empty run asks nothing.
 */
export function useLiveDrawnChain(chain: readonly TscnNode[], basePath: string): readonly TscnNode[] {
  const paths = useMemo(() => pathsAlong(chain, basePath), [chain, basePath]);
  const select = useMemo(
    () =>
      paths.length === 0
        ? null
        : (patches: NodePatches): NodePatches =>
            new Map(
              paths.flatMap((path) => (patches.has(path) ? [[path, patches.get(path)!] as const] : []))
            ),
    [paths]
  );
  const patches = useLiveScenePassSelection(liveDrawnPatches, select, sameEntries) ?? NO_PATCHES;
  return useMemo(
    () => chain.map((node, index) => patchedNode(node, patches.get(paths[index]!))),
    [chain, paths, patches]
  );
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
