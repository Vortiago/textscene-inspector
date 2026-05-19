/**
 * Synchronous access to a scene's SubResources from node components.
 *
 * Used by MeshInstance3D (and any future node that consumes inline TSCN
 * SubResources like primitive meshes or StandardMaterial3D) to look up
 * resources by SubResource id without going through the async useResource
 * hook — primitive resolution is purely synchronous.
 *
 * Provided either directly by tests, or by HierarchyContext consumers
 * (WI-R3F-4) once that lands. Defaults to empty so components rendered
 * without a provider degrade to placeholder paths instead of throwing.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { TscnExternalResource, TscnInternalResource } from '../parser/types';

export interface SceneResources {
  internalResources: readonly TscnInternalResource[];
  externalResources: readonly TscnExternalResource[];
}

const EMPTY: SceneResources = {
  internalResources: [],
  externalResources: [],
};

const SceneResourcesContext = createContext<SceneResources>(EMPTY);

export function useSceneResources(): SceneResources {
  return useContext(SceneResourcesContext);
}

export interface SceneResourcesProviderProps {
  internalResources?: readonly TscnInternalResource[];
  externalResources?: readonly TscnExternalResource[];
  children: ReactNode;
}

export function SceneResourcesProvider({
  internalResources = [],
  externalResources = [],
  children,
}: SceneResourcesProviderProps) {
  const value = useMemo<SceneResources>(
    () => ({ internalResources, externalResources }),
    [internalResources, externalResources]
  );
  return <SceneResourcesContext.Provider value={value}>{children}</SceneResourcesContext.Provider>;
}

/**
 * Find a SubResource by id. Matches both the `data.id` runtime key and
 * the parser's structural `id` field for cross-pipeline compatibility.
 */
export function findSubResource(
  internalResources: readonly TscnInternalResource[],
  id: string
): TscnInternalResource | undefined {
  return internalResources.find((r) => {
    const dataId = (r.data as { id?: string }).id;
    return dataId === id || String(r.id) === id;
  });
}
