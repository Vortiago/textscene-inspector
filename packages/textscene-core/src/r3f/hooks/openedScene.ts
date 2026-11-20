import { useLayoutEffect, useSyncExternalStore } from 'react';
import type { Scene } from '../../scene/openScene.js';

/** Keeps an opened scene on the newest text, and disposes it when the caller lets it go. */
export function useSceneText(scene: Scene, source: string): void {
  useLayoutEffect(() => scene.setSource(source), [scene, source]);
  useLayoutEffect(() => () => scene.dispose(), [scene]);
}

/** The scene's parse, and the graph the views draw: the parse with the host's writes laid on. */
export function useSceneGraphs(scene: Scene) {
  const parsed = useSyncExternalStore(scene.subscribe, scene.parse);
  const sceneGraph = useSyncExternalStore(scene.subscribe, scene.written);
  return { parsed, sceneGraph };
}
