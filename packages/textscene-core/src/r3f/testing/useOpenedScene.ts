import { useLayoutEffect, useMemo } from 'react';
import { openScene, type Scene } from '../../scene/openScene.js';
import type { ResourceProvider } from '../../resources/ResourceProvider.js';
import { useResourceLoader } from '../../resources/useResource.js';
import { adoptLoader } from '../sceneResourcePipeline.js';

/** The files of a scene with no loader above it, which draws with no file. */
const NO_FILES: ResourceProvider = { loadResource: async () => null };

/** A test's scene: a new text keeps its loads, and a loader above serves it. */
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
  useLayoutEffect(() => scene.setSource(source), [scene, source]);
  useLayoutEffect(() => () => scene.dispose(), [scene]);
  return scene;
}
