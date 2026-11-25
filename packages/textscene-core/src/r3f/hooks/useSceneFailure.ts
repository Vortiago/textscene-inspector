import { useSyncExternalStore } from 'react';
import type { Scene } from '../../scene/openScene.js';
import type { SceneFailure } from '../../scene/sceneFiles.js';

const NO_SUBSCRIPTION = () => () => {};

/** `scene.sceneFailure()`, rendered again on each change. None without a scene. */
export function useSceneFailure(scene: Scene | undefined): SceneFailure | null {
  const failure = () => scene?.sceneFailure() ?? null;
  return useSyncExternalStore(scene?.subscribe ?? NO_SUBSCRIPTION, failure, failure);
}
