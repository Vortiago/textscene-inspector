import { useLayoutEffect, useState } from 'react';
import { openScene, type ResourceProvider, type Scene } from '@textscene/renderer';

/** The previewer's scene, one per provider and path. Null until the effect that disposes it opens it. */
export function useScene(source: string, provider: ResourceProvider, rootScenePath: string): Scene | null {
  const [scene, setScene] = useState<Scene | null>(null);
  useLayoutEffect(() => {
    const opened = openScene({ source: '', provider, rootScenePath });
    setScene(opened);
    return () => opened.dispose();
  }, [provider, rootScenePath]);
  useLayoutEffect(() => scene?.setSource(source), [scene, source]);
  return scene;
}
