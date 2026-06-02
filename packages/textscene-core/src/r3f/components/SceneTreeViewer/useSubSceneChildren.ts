/**
 * Resolve the dynamically-loaded PackedScene children of an instance
 * node so the SceneTreeViewer can render the sub-scene's tree inline.
 *
 * Pre-WI-HALL-1 the tree only walked the parsed root scene's
 * `node.children`. The 3D viewport (via NodeDispatcher's
 * `InstancedSceneSubtree`) loaded sub-scenes and rendered them, but the
 * tree was blind to that — instance nodes appeared as leaves with a 📦
 * marker and no way to navigate INTO the sub-scene from the tree.
 *
 * This hook mirrors NodeDispatcher's resolution path. Given a
 * potentially-instancing node, it:
 *   1. Detects `node.instance` (TSCN `ExtResource("id")` or raw
 *      `res://` path).
 *   2. Resolves the ID against the host scene's externalResources to
 *      get the `res://` path.
 *   3. Routes through `useResource<TscnScene>(scenePath, 'PackedScene')`
 *      — which kicks off the load on cache miss and returns the cached
 *      scene on hit. Same event-bus + late-arrival flow NodeDispatcher
 *      uses, so the tree updates automatically when the sub-scene
 *      arrives.
 *
 * Returns the loaded sub-scene's root nodes, or null when not
 * applicable (no instance ref, not yet loaded, or failed to load).
 * Callers concatenate these with `node.children` for rendering.
 */
import type { TscnNode, TscnScene, TscnExternalResource } from '../../../parser/types';
import { useResource } from '../../../resources/useResource';
import { resolveInstancePath } from '../../../resources/SubResourceResolver';

export function useSubSceneChildren(
  node: TscnNode,
  externalResources: readonly TscnExternalResource[]
): readonly TscnNode[] | null {
  const scenePath = node.instance
    ? resolveInstancePath(node.instance, externalResources)
    : null;

  // useResource short-circuits when given an empty path, so passing ''
  // for non-instance rows keeps the hook-call count stable across all
  // tree rows (rules of hooks).
  const result = useResource<TscnScene>(scenePath ?? '', 'PackedScene');

  if (!scenePath || result.status !== 'loaded' || !result.value) {
    return null;
  }
  return result.value.nodes;
}
