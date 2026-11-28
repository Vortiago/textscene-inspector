import { useSyncExternalStore, useId, useMemo, type ReactNode } from 'react';
import type { Scene } from '../scene/openScene.js';
import { useSceneLoader } from './sceneResourcePipeline.js';
import './sceneLiveTree.js';
import { SceneChangeResetter } from './SceneChangeResetter.js';
import { viewProviders } from './viewProviders.js';

interface TscnSceneProviderProps {
  /** Every view of the scene shares its parse and its resource loader. */
  scene: Scene;
  children: ReactNode;
}

export function TscnSceneProvider({ scene, children }: TscnSceneProviderProps) {
  const panelId = useId();
  const { sceneGraph, error } = useSyncExternalStore(scene.subscribe, scene.parse);
  if (error) throw new Error(`expected the text of a .tscn scene, got: ${error}`);
  const hierarchyValue = useMemo(() => ({ sceneGraph, panelId, scene }), [sceneGraph, panelId, scene]);
  const withProviders = viewProviders({
    hierarchyValue,
    loader: useSceneLoader(scene),
  });

  // A new parse clears the selection, or the highlight draws a removed node. A write keeps every node.
  return withProviders(
    <>
      <SceneChangeResetter sceneGraph={sceneGraph} />
      {children}
    </>
  );
}
