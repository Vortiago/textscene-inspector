/**
 * Synchronous access to a scene's resources by id from node components, without
 * the async useResource hook. With no provider it is empty, so a component
 * renders its placeholder instead of throwing.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { TscnExternalResource, TscnInternalResource } from '../parser/types';

// `findSubResource` lives in the pure resources layer (next to its ExtResource
// twin, `findExtResource`); re-exported here for its many R3F importers.
export { findSubResource } from '../resources/SubResourceResolver';

export interface SceneResources {
  internalResources: readonly TscnInternalResource[];
  externalResources: readonly TscnExternalResource[];
}

/** No resources: the pools of a scene with none, or of a level that has not resolved. */
export const NO_RESOURCES: SceneResources = {
  internalResources: [],
  externalResources: [],
};

const SceneResourcesContext = createContext<SceneResources>(NO_RESOURCES);
SceneResourcesContext.displayName = 'SceneResourcesContext';

export function useSceneResources(): SceneResources {
  return useContext(SceneResourcesContext);
}

export interface SceneResourcesProviderProps {
  internalResources?: readonly TscnInternalResource[];
  externalResources?: readonly TscnExternalResource[];
  children: ReactNode;
}

/**
 * Stable empty defaults. A `= []` default is a new array every render, and as a
 * `useMemo` dependency it re-fires every `useSceneResources()` consumer.
 */
const NO_INTERNAL: readonly TscnInternalResource[] = [];
const NO_EXTERNAL: readonly TscnExternalResource[] = [];

export function SceneResourcesProvider({
  internalResources = NO_INTERNAL,
  externalResources = NO_EXTERNAL,
  children,
}: SceneResourcesProviderProps) {
  // This scene's own id shadows the parent's. A merged sub-scene (ADR-0013) re-dispatches under
  // this provider, and the children the host added under its instance node carry host ids. An
  // external id resolves to its last holder and an internal id to its first, so the own table
  // goes after the parent's external table and before its internal one.
  const parent = useContext(SceneResourcesContext);
  const value = useMemo<SceneResources>(
    () => ({
      internalResources: [...internalResources, ...parent.internalResources],
      externalResources: [...parent.externalResources, ...externalResources],
    }),
    [internalResources, externalResources, parent]
  );
  return <SceneResourcesContext.Provider value={value}>{children}</SceneResourcesContext.Provider>;
}
