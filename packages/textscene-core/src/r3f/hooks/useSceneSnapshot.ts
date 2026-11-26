import { useSyncExternalStore } from 'react';
import type { Scene } from '../../scene/openScene.js';
import { subscribeToNothing } from '../../utils/subscribeToNothing.js';

/** `read(scene)`, rendered again on each change of the scene, and `fallback` without a scene. */
export function useSceneSnapshot<T>(scene: Scene | undefined, read: (scene: Scene) => T, fallback: T): T {
  const snapshot = () => (scene ? read(scene) : fallback);
  return useSyncExternalStore(scene?.subscribe ?? subscribeToNothing, snapshot, snapshot);
}
