/**
 * Resolve a slash-joined node path against the same live (inline +
 * sub-scene) tree the SceneTreeViewer renders.
 *
 * BUG 1 (WI-HALL-1 follow-up): `NodeDetailsPanel` previously looked the
 * selected path up in `SceneGraph.flattenedNodes`, which only contains
 * the inline root scene's nodes (the shell never `addScene`s the
 * lazily-loaded sub-scenes). So clicking any node INSIDE an instanced
 * PackedScene (every roof_lamp / PhotoFrame interior node in the marquee
 * Hallway) failed the lookup and the inspector stayed on the "Select a
 * node" placeholder.
 *
 * This resolver mirrors `TreeNode`'s path construction exactly: it walks
 * the root scene's nodes by name, and at any instance node it descends
 * into the referenced PackedScene's root nodes (resolved through the
 * loader's scene cache, the same source `useSubSceneChildren` reads). So
 * any row the tree can render becomes resolvable.
 */
import type * as THREE from 'three';
import type { TscnNode, TscnExternalResource } from '../../../parser/types';
import { resolveInstancePath } from '../../../resources/SubResourceResolver';
import { mergeInstanceRoot } from '../../../resources/mergeInstanceRoot';
import { GLB_SCENE_ROOT_TYPE } from '../../internal/glb-scene-root/Component';
import { glbSceneRootChildren } from '../../internal/glb-scene-root/glbHierarchy';

/**
 * Minimal read surface the resolver needs from the loader's scene cache.
 * `undefined` = never requested, `null` = previously failed, value = loaded.
 */
export interface CachedSceneSource {
  getCached: (
    path: string
  ) =>
    | { nodes: readonly TscnNode[]; externalResources?: readonly TscnExternalResource[] }
    | null
    | undefined;
}

/** Read surface for the loader's GLB cache — lets the resolver descend into a GLB's internals. */
export interface CachedGlbSource {
  getCached: (path: string) => THREE.Object3D | null | undefined;
}

/**
 * The node as the tree and viewport render it: a single-root `.tscn` instance
 * COLLAPSES into its sub-scene root (Instance root merge, ADR-0013), adopting
 * the root's type/properties/children. Returning the merged node keeps the
 * Inspector's type + property display consistent with the tree row badge and
 * the viewport for a selected instance row. `.glb`/multi-root instances (and
 * non-instances, or not-yet-cached scenes) are returned unchanged.
 */
function collapsedNode(
  node: TscnNode,
  externalResources: readonly TscnExternalResource[],
  sceneCache: CachedSceneSource
): TscnNode {
  if (!node.instance) return node;
  const scenePath = resolveInstancePath(node.instance, externalResources);
  if (!scenePath) return node;
  const cached = sceneCache.getCached(scenePath);
  if (!cached) return node;
  return mergeInstanceRoot(node, cached) ?? node;
}

/**
 * The children the tree shows for a node, paired with the `externalResources`
 * scope those children resolve their OWN instance refs against. For an instance
 * node that scope is the LOADED sub-scene's resource table — a nested instance
 * (e.g. the GLB inside player.tscn) references its parent sub-scene's
 * ExtResources, which are absent from the outer scene, so descent must switch
 * scope or the inner instance fails to resolve. Non-instance / GLB children
 * keep the incoming scope.
 */
interface ChildScope {
  children: readonly TscnNode[];
  externalResources: readonly TscnExternalResource[];
}

function childrenForNode(
  node: TscnNode,
  externalResources: readonly TscnExternalResource[],
  sceneCache: CachedSceneSource,
  glbCache?: CachedGlbSource
): ChildScope {
  const inline = node.children;
  const keep = (children: readonly TscnNode[]): ChildScope => ({ children, externalResources });

  // GLBSceneRoot: its children are the loaded GLB's internal nodes (no instance
  // refs of their own), walked the same way useGlbChildren does.
  if (node.type === GLB_SCENE_ROOT_TYPE && glbCache) {
    const glbPath = (node.properties as Record<string, unknown>).glbPath as string | undefined;
    const object = glbPath ? glbCache.getCached(glbPath) : undefined;
    if (object) return keep(glbSceneRootChildren(object));
  }

  if (!node.instance) return keep(inline);

  const scenePath = resolveInstancePath(node.instance, externalResources);
  if (!scenePath) return keep(inline);

  const cached = sceneCache.getCached(scenePath);
  if (!cached) return keep(inline);

  // Children of the loaded sub-scene resolve against ITS resource table.
  const subResources = cached.externalResources ?? [];

  // Collapsed single-root instance: descend into the merged children (root's
  // children first, then host-added), matching TreeNode's merged child list.
  const merged = mergeInstanceRoot(node, cached);
  if (merged) return { children: merged.children, externalResources: subResources };

  // Fallback (GLB / multi-root): inline children render before the loaded
  // roots in TreeNode, so search inline first to match the tree's hierarchy.
  return {
    children: inline.length > 0 ? [...inline, ...cached.nodes] : cached.nodes,
    externalResources: subResources,
  };
}

/**
 * Walk `path` (e.g. `Hallway/HallwayGeometry/roof_lamp/plafoniera`)
 * starting from `roots`, descending into sub-scenes at instance nodes.
 * Returns the matched node, or null when any segment is unresolvable.
 *
 * Note: a single-root sub-scene COLLAPSES into its instance node (Instance
 * root merge, ADR-0013), so the next path segment after an instance node is
 * the sub-scene root's child — the root's own name is not a segment. This
 * matches the path the tree and viewport produce (`Coins/Coin1/Animation`,
 * not `Coins/Coin1/Coin/Animation`), keeping selection binding consistent.
 */
export function resolveNodeByPath(
  path: string,
  roots: readonly TscnNode[],
  externalResources: readonly TscnExternalResource[],
  sceneCache: CachedSceneSource,
  glbCache?: CachedGlbSource
): TscnNode | null {
  const segments = path.split('/').filter((s) => s.length > 0);
  if (segments.length === 0) return null;

  let candidates: readonly TscnNode[] = roots;
  let candidatesResources = externalResources;
  let current: TscnNode | null = null;
  // The scope `current` itself lives in (its parent's child scope) — used to
  // resolve `current`'s own instance ref when collapsing it at the end.
  let currentResources = externalResources;

  for (const segment of segments) {
    const match = candidates.find((n) => n.name === segment);
    if (!match) return null;
    current = match;
    currentResources = candidatesResources;
    const next = childrenForNode(match, candidatesResources, sceneCache, glbCache);
    candidates = next.children;
    candidatesResources = next.externalResources;
  }

  // Return the node as the tree/viewport render it — a collapsed instance row
  // resolves to its merged (root-typed) identity, not the bare wrapper.
  return current ? collapsedNode(current, currentResources, sceneCache) : null;
}
