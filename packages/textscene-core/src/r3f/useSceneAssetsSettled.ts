/**
 * Whether the resources, textures and scene fonts a scene uses have all arrived. It needs no
 * viewport shell, so a canvas mounted alone answers it too.
 */
import { useCallback, useSyncExternalStore } from 'react';
import { useViewWork } from '../resources/ResourceLoaderContext.js';
import { isViewWorking, subscribeSceneWork } from './sceneWork.js';

export function useSceneAssetsSettled(): boolean {
  const work = useViewWork();
  const subscribe = useCallback((onChange: () => void) => subscribeSceneWork(work, onChange), [work]);
  const isSettled = () => !isViewWorking(work);
  return useSyncExternalStore(subscribe, isSettled, isSettled);
}
