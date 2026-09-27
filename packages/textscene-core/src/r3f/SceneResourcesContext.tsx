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
  // Prepended to the parent pool, so this scene's own id wins on first match.
  // A merged sub-scene (ADR-0013) re-dispatches under this provider, and the
  // children the host added under its instance node carry host `ExtResource` ids.
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
