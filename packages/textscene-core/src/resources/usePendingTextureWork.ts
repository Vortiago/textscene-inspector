/** The page-wide count of procedural textures still being built or uploaded, as React state. */
import { useSyncExternalStore } from 'react';
import { pendingTextureWork, subscribeTextureWork } from './textures/textureWork';

export function usePendingTextureWork(): number {
  return useSyncExternalStore(subscribeTextureWork, pendingTextureWork, pendingTextureWork);
}
