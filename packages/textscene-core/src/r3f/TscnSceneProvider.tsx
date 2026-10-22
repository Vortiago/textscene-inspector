/**
 * `<TscnSceneProvider>` mounts the contexts `<TscnCanvas>` reads, from a parsed scene and a
 * `ResourceProvider`. It is the preview shell's provider stack with the shell's defaults, so a
 * canvas inside it behaves as the shell's canvas does, with none of the shell's UI around it.
 */
import { useId, useMemo, type ReactNode } from 'react';
import type { TscnScene } from '../parser/types.js';
import type { ResourceProvider } from '../resources/ResourceProvider.js';
import { createResourcePipeline } from '../resources/createResourcePipeline.js';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext.js';
import { toSceneGraph } from './hooks/useParsedScene.js';
import { SceneChangeResetter } from './components/TscnPreviewShell/SceneChangeResetter.js';
import {
  DEFAULT_ROOT_SCENE_PATH,
  previewShellProviders,
} from './components/TscnPreviewShell/previewShellProviders.js';

interface TscnSceneProviderProps {
  /**
   * The scene to draw, as `TscnParser` returns it. The provider moves the targets of its
   * RemoteTransform nodes in this object, so parse one scene for each provider.
   */
  scene: TscnScene;
  /** How the scene's `res://` resources load. Another provider starts another resource loader. */
  provider: ResourceProvider;
  /** The path the scene opens under. */
  rootScenePath?: string;
  children: ReactNode;
}

export function TscnSceneProvider({
  scene,
  provider,
  rootScenePath = DEFAULT_ROOT_SCENE_PATH,
  children,
}: TscnSceneProviderProps) {
  const panelId = useId();
  const hierarchyValue = useMemo(
    () => ({ sceneGraph: toSceneGraph(rootScenePath, scene), panelId }),
    [rootScenePath, scene, panelId]
  );
  const { loader } = useMemo(() => createResourcePipeline(provider), [provider]);

  const withProviders = previewShellProviders({ hierarchyValue, panelId, rootScenePath });

  // The resetter clears the selection when `scene` changes, or the highlight draws a removed node.
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
