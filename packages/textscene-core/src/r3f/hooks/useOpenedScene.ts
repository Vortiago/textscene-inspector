import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { openScene, type Scene } from '../../scene/openScene.js';
import type { ResourceProvider } from '../../resources/ResourceProvider.js';
import { useResourceLoader } from '../../resources/useResource.js';
import { adoptLoader } from '../sceneResourcePipeline.js';

/** The files of a shell with no loader above it, which draws its scene with no file. */
const NO_FILES: ResourceProvider = { loadResource: async () => null };

/** A new text keeps the scene and its loads. A loader above it is a test's, which then serves the scene. */
export function useOpenedScene(source: string, rootScenePath: string, provider?: ResourceProvider): Scene {
  const testLoader = useResourceLoader();
  // `source` is left out: a new text replaces the parse of the same scene, below.
  const scene = useMemo(() => {
    const files = provider ?? testLoader?.fileEventBus?.getProvider() ?? NO_FILES;
    const opened = openScene({ source, provider: files, rootScenePath });
    if (testLoader) adoptLoader(opened, testLoader);
    return opened;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testLoader, provider, rootScenePath]);
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
