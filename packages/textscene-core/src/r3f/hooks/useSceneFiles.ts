import type { Scene } from '../../scene/openScene.js';
import type { SceneFile } from '../../scene/sceneFiles.js';
import { useSceneSnapshot } from './useSceneSnapshot.js';

const NO_FILES: readonly SceneFile[] = [];

/** `scene.files()`, rendered again on each change. No files without a scene. */
export function useSceneFiles(scene: Scene | undefined): readonly SceneFile[] {
  return useSceneSnapshot(scene, (current) => current.files(), NO_FILES);
}
