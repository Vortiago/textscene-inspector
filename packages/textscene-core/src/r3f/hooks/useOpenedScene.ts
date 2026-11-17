import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { openScene, type Scene } from '../../scene/openScene.js';
import type { ResourceProvider } from '../../resources/ResourceProvider.js';
import { useResourceLoader } from '../../resources/useResource.js';
import { adoptLoader } from '../sceneResourcePipeline.js';

/** The files of a shell with no loader above it, which draws its scene with no file. */
const NO_FILES: ResourceProvider = { loadResource: async () => null };

/** The scene of the shell's text, over the host's loader. A new text keeps the scene and its loads. */
export function useOpenedScene(source: string, rootScenePath: string): Scene {
  const loader = useResourceLoader();
  // `source` is left out: a new text replaces the parse of the same scene, below.
  const scene = useMemo(() => {
    const provider = loader?.fileEventBus?.getProvider() ?? NO_FILES;
    const opened = openScene({ source, provider, rootScenePath });
    if (loader) adoptLoader(opened, loader);
    return opened;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loader, rootScenePath]);
  useSceneText(scene, source);
  return scene;
}

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
