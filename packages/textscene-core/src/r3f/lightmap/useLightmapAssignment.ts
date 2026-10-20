/** The LightmapGI that lights the enclosing node, for a surface drawn in React. */

import { useThree } from '@react-three/fiber';
import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';
import { LIGHTMAP_NODE_ITSELF } from '../../godot/scene/lightmapGi';
import { useNodePath } from '../contexts/NodePathContext';
import { lightmapsOf, type LightmapAssignment } from './sceneLightmaps';

/** The index of the baked mesh a node draws around its surfaces, such as a GridMap's. */
const SubInstanceContext = createContext(LIGHTMAP_NODE_ITSELF);
SubInstanceContext.displayName = 'LightmapSubInstanceContext';

export const LightmapSubInstanceProvider = SubInstanceContext.Provider;

/**
 * The enclosing node's assignment, or its baked mesh's inside a {@link LightmapSubInstanceProvider}.
 * Null when no LightmapGI names it, or outside the dispatcher.
 */
export function useLightmapAssignment(): LightmapAssignment | null {
  const lightmaps = lightmapsOf(useThree((state) => state.scene));
  const path = useNodePath();
  const subInstance = useContext(SubInstanceContext);
  const subscribe = useCallback((listener: () => void) => lightmaps.subscribe(listener), [lightmaps]);
  const assignment = useCallback(
    () => (path === null ? null : lightmaps.assignmentFor(path, subInstance)),
    [lightmaps, path, subInstance]
  );
  return useSyncExternalStore(subscribe, assignment);
}
