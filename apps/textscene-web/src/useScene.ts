import { useLayoutEffect, useMemo } from 'react';
import { openScene, type ResourceProvider, type Scene } from '@textscene/renderer';

/** The scene the previewer shows: a new one for each provider object or path, kept on the newest text. */
export function useScene(source: string, provider: ResourceProvider, rootScenePath: string): Scene {
  // `source` is left out: a new text replaces the parse of the same scene, below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const scene = useMemo(() => openScene({ source, provider, rootScenePath }), [provider, rootScenePath]);
  useLayoutEffect(() => scene.setSource(source), [scene, source]);
  useLayoutEffect(() => () => scene.dispose(), [scene]);
  return scene;
}
