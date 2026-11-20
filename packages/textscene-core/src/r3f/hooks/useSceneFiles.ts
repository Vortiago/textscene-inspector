import { useSyncExternalStore } from 'react';
import type { Scene } from '../../scene/openScene.js';
import type { SceneFile } from '../../scene/sceneFiles.js';

const NO_FILES: readonly SceneFile[] = [];
const NO_SUBSCRIPTION = () => () => {};

/** `scene.files()`, rendered again on each change. No files without a scene. */
export function useSceneFiles(scene: Scene | undefined): readonly SceneFile[] {
  const files = () => scene?.files() ?? NO_FILES;
  return useSyncExternalStore(scene?.subscribe ?? NO_SUBSCRIPTION, files, files);
}
