/**
 * `<TscnSceneProvider>` mounts the contexts `<TscnCanvas>` reads, from the text of a scene and a
 * `ResourceProvider`. It is the preview shell's provider stack with the shell's defaults, so a
 * canvas inside it behaves as the shell's canvas does, with none of the shell's UI around it.
 */
import { useId, useMemo, type ReactNode } from 'react';
import type { ResourceProvider } from '../resources/ResourceProvider.js';
import { createResourcePipeline } from '../resources/createResourcePipeline.js';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext.js';
import { useParsedScene } from './hooks/useParsedScene.js';
import { SceneChangeResetter } from './components/TscnPreviewShell/SceneChangeResetter.js';
import {
  DEFAULT_ROOT_SCENE_PATH,
  previewShellProviders,
} from './components/TscnPreviewShell/previewShellProviders.js';

interface TscnSceneProviderProps {
  /**
   * The text of the `.tscn` scene to draw. The provider parses it itself, since drawing a scene
   * moves the targets of its RemoteTransform nodes.
   */
  source: string;
  /** How the scene's `res://` resources load. Another provider starts another resource loader. */
  provider: ResourceProvider;
  /** The path the scene opens under. */
  rootScenePath?: string;
  children: ReactNode;
}

export function TscnSceneProvider({
  source,
  provider,
  rootScenePath = DEFAULT_ROOT_SCENE_PATH,
  children,
}: TscnSceneProviderProps) {
  const panelId = useId();
  const { sceneGraph, error } = useParsedScene(source, rootScenePath);
  if (error) throw new Error(`expected the text of a .tscn scene, got: ${error}`);
  const hierarchyValue = useMemo(() => ({ sceneGraph, panelId }), [sceneGraph, panelId]);
  const { loader } = useMemo(() => createResourcePipeline(provider), [provider]);

  const withProviders = previewShellProviders({ hierarchyValue, panelId, rootScenePath });

  // The resetter clears the selection when `source` changes, or the highlight draws a removed node.
  return (
    <ResourceLoaderProvider loader={loader}>
      {withProviders(
        <>
          <SceneChangeResetter sceneGraph={hierarchyValue.sceneGraph} />
          {children}
        </>
      )}
    </ResourceLoaderProvider>
  );
}
