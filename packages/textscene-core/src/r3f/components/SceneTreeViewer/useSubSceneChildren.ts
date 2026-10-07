/**
 * The loaded PackedScene children of an instance node, resolved as
 * NodeDispatcher resolves them, so the outliner renders the sub-scene inline.
 * Null with no instance ref, before the load, or after a failed load.
 */
import { useMemo } from 'react';
import type { TscnNode, TscnExternalResource } from '../../../parser/types';
import { resolveInstancePath } from '../../../resources/SubResourceResolver';
import { useInstancedScene } from '../../hooks/useInstancedScene';

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
  const scenePath = node.instance ? resolveInstancePath(node.instance, externalResources) : null;

  // The viewport skips a sub-scene it never renders, so the row registers it too.
  const result = useInstancedScene(node.instance ?? '', externalResources, scenePath);

  // A stable identity, since callers feed it into useMemo deps.
  return useMemo(() => {
    if (!scenePath || result.status !== 'loaded' || !result.value) {
      return null;
    }
    return { nodes: result.value.nodes, externalResources: result.value.externalResources };
  }, [scenePath, result.status, result.value]);
}
