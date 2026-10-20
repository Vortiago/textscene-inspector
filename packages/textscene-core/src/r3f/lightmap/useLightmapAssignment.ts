/** The LightmapGI that lights the enclosing node, for a surface drawn in React. */

import { useThree } from '@react-three/fiber';
import { useCallback, useSyncExternalStore } from 'react';
import { useNodePath } from '../contexts/NodePathContext';
import { lightmapsOf, type LightmapAssignment } from './sceneLightmaps';

/** The enclosing node's assignment, or null when no LightmapGI names it or outside the dispatcher. */
export function useLightmapAssignment(): LightmapAssignment | null {
  const lightmaps = lightmapsOf(useThree((state) => state.scene));
  const path = useNodePath();
  const subscribe = useCallback((listener: () => void) => lightmaps.subscribe(listener), [lightmaps]);
  const assignment = useCallback(
    () => (path === null ? null : lightmaps.assignmentFor(path)),
    [lightmaps, path]
  );
  return useSyncExternalStore(subscribe, assignment);
}
