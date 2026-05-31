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
import type { TscnNode, TscnExternalResource } from '../../../parser/types';
import { parseResourceReference } from '../../../resources/SubResourceResolver';

/**
 * Minimal read surface the resolver needs from the loader's scene cache.
 * `undefined` = never requested, `null` = previously failed, value = loaded.
 */
export interface CachedSceneSource {
  getCached: (path: string) => { nodes: readonly TscnNode[] } | null | undefined;
}

/**
 * Resolve `ExtResource("id")` or a raw `res://` path against a list of
 * external resources. Mirrors `useSubSceneChildren.resolveInstancePath`.
 */
function resolveInstancePath(
  instanceRef: string,
  externalResources: readonly TscnExternalResource[]
): string | null {
  if (instanceRef.startsWith('res://')) {
    return instanceRef;
  }
  const parsed = parseResourceReference(instanceRef);
  if (!parsed || parsed.type !== 'ExtResource') return null;
  const ext = externalResources.find((r) => r.id === parsed.id);
  return ext?.path ?? null;
}

/**
 * Return the children the tree shows for a node: its inline children
 * plus, for an instance node, the cached sub-scene's root nodes.
 */
function childrenForNode(
  node: TscnNode,
  externalResources: readonly TscnExternalResource[],
  sceneCache: CachedSceneSource
): readonly TscnNode[] {
  const inline = node.children;
  if (!node.instance) return inline;

  const scenePath = resolveInstancePath(node.instance, externalResources);
  if (!scenePath) return inline;

  const cached = sceneCache.getCached(scenePath);
  if (!cached) return inline;

  // Inline children render before sub-scene children in TreeNode, so the
  // resolver must search inline first to match the tree's view of the
  // hierarchy.
  return inline.length > 0 ? [...inline, ...cached.nodes] : cached.nodes;
}

/**
 * Walk `path` (e.g. `Hallway/HallwayGeometry/roof_lamp/plafoniera`)
 * starting from `roots`, descending into sub-scenes at instance nodes.
 * Returns the matched node, or null when any segment is unresolvable.
 *
 * Note: a sub-scene's root nodes are addressed under the INSTANCE node's
 * path (TreeNode passes `parentPath = nodePath` for both inline and
 * sub-scene children), so the sub-scene root is just the next path
 * segment — there is no extra synthetic segment to skip.
 */
export function resolveNodeByPath(
  path: string,
  roots: readonly TscnNode[],
  externalResources: readonly TscnExternalResource[],
  sceneCache: CachedSceneSource
): TscnNode | null {
  const segments = path.split('/').filter((s) => s.length > 0);
  if (segments.length === 0) return null;

  let candidates: readonly TscnNode[] = roots;
  let current: TscnNode | null = null;

  for (const segment of segments) {
    const match = candidates.find((n) => n.name === segment);
    if (!match) return null;
    current = match;
    candidates = childrenForNode(match, externalResources, sceneCache);
  }

  return current;
}
