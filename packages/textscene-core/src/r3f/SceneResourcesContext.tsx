/**
 * Synchronous access to a scene's SubResources from node components.
 *
 * Used by MeshInstance3D (and any future node that consumes inline TSCN
 * SubResources like primitive meshes or StandardMaterial3D) to look up
 * resources by SubResource id without going through the async useResource
 * hook — primitive resolution is purely synchronous.
 *
 * Provided either directly by tests, or by HierarchyContext consumers
 * once that wiring lands. Defaults to empty so components rendered
 * without a provider degrade to placeholder paths instead of throwing.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { TscnExternalResource, TscnInternalResource } from '../parser/types';

// `findSubResource` lives in the pure resources layer (next to its ExtResource
// twin, `resolveExtResourcePath`); re-exported here for its many R3F importers.
export { findSubResource } from '../resources/SubResourceResolver';

export interface SceneResources {
  internalResources: readonly TscnInternalResource[];
  externalResources: readonly TscnExternalResource[];
}

const EMPTY: SceneResources = {
  internalResources: [],
  externalResources: [],
};

const SceneResourcesContext = createContext<SceneResources>(EMPTY);
SceneResourcesContext.displayName = 'SceneResourcesContext';

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
  // Inherit the ambient (parent-scene) pool, with this scene's own resources
  // taking precedence — `findSubResource`/`resolveExtResourcePath` use
  // first-match, so prepending own resources wins on a duplicate id.
  //
  // Why inherit: an instanced sub-scene COLLAPSES into its instance node
  // (Instance root merge, ADR-0013) and re-dispatches under this provider.
  // Children the HOST added under that instance node (e.g. the Hallway's
  // `roof_lamp`/`Door` instances parented to a `HallwayGeometry` instance)
  // carry HOST `ExtResource` ids; without inheritance they'd resolve against
  // the sub-scene's pool and fail to load. A node only ever references ids
  // from its own scene, so the fallback is exercised only by such host-scoped
  // children — sub-scene interior nodes still resolve their own ids first.
  const parent = useContext(SceneResourcesContext);
  const value = useMemo<SceneResources>(
    () => ({
      internalResources: [...internalResources, ...parent.internalResources],
      externalResources: [...externalResources, ...parent.externalResources],
    }),
    [internalResources, externalResources, parent]
  );
  return <SceneResourcesContext.Provider value={value}>{children}</SceneResourcesContext.Provider>;
}
