import { useId, useMemo, type ReactNode } from 'react';
import type { ResourceProvider } from '../resources/ResourceProvider.js';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext.js';
import { openScene, type Scene } from '../scene/openScene.js';
import { resourcePipelineOf } from './sceneResourcePipeline.js';
import { useSceneGraphs, useSceneText } from './hooks/useOpenedScene.js';
import './sceneLiveTree.js';
import { SceneChangeResetter } from './components/TscnPreviewShell/SceneChangeResetter.js';
import { previewShellProviders } from './components/TscnPreviewShell/previewShellProviders.js';

interface OpenedSceneProps {
  /** The scene `openScene` gave. Every view of it shares its parse and its resource loader. */
  scene: Scene;
  children: ReactNode;
}

interface SceneTextProps {
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

export type TscnSceneProviderProps = OpenedSceneProps | SceneTextProps;

export function TscnSceneProvider(props: TscnSceneProviderProps) {
  return 'scene' in props ? (
    <SceneProviders scene={props.scene}>{props.children}</SceneProviders>
  ) : (
    <SceneTextProviders {...props} />
  );
}

/** Opens the text as a scene of its own, which keeps its resource loader while `provider` holds. */
function SceneTextProviders({ source, provider, rootScenePath, children }: SceneTextProps) {
  // `source` is left out: a new text replaces the parse of the same scene, below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const scene = useMemo(() => openScene({ source, provider, rootScenePath }), [provider, rootScenePath]);
  useSceneText(scene, source);
  return <SceneProviders scene={scene}>{children}</SceneProviders>;
}

function SceneProviders({ scene, children }: OpenedSceneProps) {
  const panelId = useId();
  const { parsed, sceneGraph } = useSceneGraphs(scene);
  if (parsed.error) throw new Error(`expected the text of a .tscn scene, got: ${parsed.error}`);
  const hierarchyValue = useMemo(() => ({ sceneGraph, panelId, scene }), [sceneGraph, panelId, scene]);
  const { loader } = resourcePipelineOf(scene);
  const withProviders = previewShellProviders({
    hierarchyValue,
    panelId,
    rootScenePath: scene.rootScenePath,
  });

  // A new parse clears the selection, or the highlight draws a removed node. A write keeps every node.
  return (
    <ResourceLoaderProvider loader={loader}>
      {withProviders(
        <>
          <SceneChangeResetter sceneGraph={parsed.sceneGraph} />
          {children}
        </>
      )}
    </ResourceLoaderProvider>
  );
}
