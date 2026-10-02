/**
 * The `res://` paths of the PackedScenes whose instances enclose the node being
 * rendered, outermost first: `SceneScope.instancedScenePaths` for the React walk.
 * `InstancedNode` reads it to stop cyclic instancing and extends it for the
 * sub-scene it renders.
 */

import { createContext, useContext, type ReactNode } from 'react';

const NO_SCENE_PATHS: readonly string[] = [];

const InstancedScenePathsContext = createContext<readonly string[]>(NO_SCENE_PATHS);
InstancedScenePathsContext.displayName = 'InstancedScenePathsContext';

export interface InstancedScenePathsProviderProps {
  paths: readonly string[];
  children: ReactNode;
}

export function InstancedScenePathsProvider({ paths, children }: InstancedScenePathsProviderProps) {
  return <InstancedScenePathsContext.Provider value={paths}>{children}</InstancedScenePathsContext.Provider>;
}

/** The enclosing scenes' paths, or an empty list outside every instance. */
export function useInstancedScenePaths(): readonly string[] {
  return useContext(InstancedScenePathsContext);
}
