/**
 * The loaded PackedScene children of an instance node, resolved as
 * NodeDispatcher resolves them, so the outliner renders the sub-scene inline.
 * Null with no instance ref, before the load, or after a failed load.
 */
import { useMemo } from 'react';
import type { TscnNode, TscnScene, TscnExternalResource } from '../../../parser/types';
import { useResource, useResourceLoader } from '../../../resources/useResource';
import { resolveInstancePath, parseResourceReference } from '../../../resources/SubResourceResolver';

/**
 * The sub-scene's root nodes with its own `externalResources`, so a nested
 * instance whose ExtResource id the outer scene lacks still resolves.
 */
export interface SubSceneChildren {
  nodes: readonly TscnNode[];
  externalResources: readonly TscnExternalResource[];
}

export function useSubSceneChildren(
  node: TscnNode,
  externalResources: readonly TscnExternalResource[]
): SubSceneChildren | null {
  const scenePath = node.instance
    ? resolveInstancePath(node.instance, externalResources)
    : null;

  // Registers the PackedScene metadata, as NodeDispatcher does. The viewport skips
  // a sub-scene it never renders, and the load then throws "Scene metadata not
  // found". Registration is idempotent, so a call per render is safe.
  const loader = useResourceLoader();
  if (loader && scenePath && node.instance) {
    const parsed = parseResourceReference(node.instance);
    if (parsed && parsed.type === 'ExtResource') {
      const ext = externalResources.find((r) => r.id === parsed.id);
      if (ext) loader.register({ id: ext.id, path: ext.path, type: ext.type });
    }
  }

  // `useResource` returns early on '', so a non-instance row keeps the same
  // hook-call count (rules of hooks).
  const result = useResource<TscnScene>(scenePath ?? '', 'scene');

  // A stable identity, since callers feed it into useMemo deps.
  return useMemo(() => {
    if (!scenePath || result.status !== 'loaded' || !result.value) {
      return null;
    }
    return { nodes: result.value.nodes, externalResources: result.value.externalResources };
  }, [scenePath, result.status, result.value]);
}
