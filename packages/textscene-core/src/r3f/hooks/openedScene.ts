import { useSyncExternalStore } from 'react';
import type { Scene } from '../../scene/openScene.js';

/** The scene's parse, and the graph the views draw: the parse with the host's writes laid on. */
export function useSceneGraphs(scene: Scene) {
  const parsed = useSyncExternalStore(scene.subscribe, scene.parse);
  const sceneGraph = useSyncExternalStore(scene.subscribe, scene.written);
  return { parsed, sceneGraph };
}
