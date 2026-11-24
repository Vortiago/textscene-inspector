import { useCallback, useSyncExternalStore } from 'react';
import { useResourceLoader } from '../resources/useResource.js';
import { hasPendingWork, pendingSceneWork, subscribeSceneWork } from './sceneWork.js';

/** Whether the resources, textures, fonts and code a scene draws with have arrived, shell or not. */
export function useSceneAssetsSettled(): boolean {
  const loader = useResourceLoader();
  const subscribe = useCallback((onChange: () => void) => subscribeSceneWork(loader, onChange), [loader]);
  const isSettled = () => !hasPendingWork(pendingSceneWork(loader));
  return useSyncExternalStore(subscribe, isSettled, isSettled);
}
