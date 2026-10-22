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
import { DEFAULT_VIEWPORT } from './contexts/ViewportModeContext.js';
import { toSceneGraph } from './hooks/useParsedScene.js';
import {
  DEFAULT_ROOT_SCENE_PATH,
  previewShellProviders,
} from './components/TscnPreviewShell/previewShellProviders.js';

interface TscnSceneProviderProps {
  /** The scene to draw, as `TscnParser` returns it. */
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
  const sceneGraph = useMemo(() => toSceneGraph(rootScenePath, scene), [rootScenePath, scene]);
  const hierarchyValue = useMemo(() => ({ sceneGraph, panelId }), [sceneGraph, panelId]);
  const { loader } = useMemo(() => createResourcePipeline(provider), [provider]);

  const withProviders = previewShellProviders({
    hierarchyValue,
    initialActiveCameraPath: undefined,
    onMissingPathsChange: undefined,
    initialViewportMode: undefined,
    initialViewport: DEFAULT_VIEWPORT,
    panelId,
    rootScenePath,
  });

  return <ResourceLoaderProvider loader={loader}>{withProviders(children)}</ResourceLoaderProvider>;
}
