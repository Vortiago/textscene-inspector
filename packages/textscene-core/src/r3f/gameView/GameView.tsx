/**
 * The In-game mode of the view: the root viewport of the scene, drawn as a game draws it at its start
 * with no script run, fitted into the element.
 */

import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import { useOptionalHierarchy } from '../contexts/HierarchyContext.js';
import { useSeatedRoots } from '../useLiveSceneTree.js';
import { usePreviewFrameloop } from '../contexts/PreviewVisibilityContext.js';
import { useProjectSettings } from '../contexts/ProjectSettingsContext.js';
import { SceneResourcesProvider } from '../SceneResourcesContext.js';
import { EditedRootProvider } from '../contexts/InstanceOwnersContext.js';
import { NodeDispatcher } from '../NodeDispatcher.js';
import { CANVAS_RENDERER_GL, CANVAS_RENDERER_PROPS } from '../canvasRenderer/canvasRendererProps.js';
import { CanvasRendererScope } from '../canvasRenderer/CanvasRendererScope.js';
import { ViewportMount } from '../../nodes/viewport/subviewport/Component.js';
import { ControlRasterLayer } from '../../nodes/viewport/subviewport/ControlRasterLayer.js';
import { gameViewportDescription } from '../viewportRender/viewportDescription.js';
import { rootViewportNode } from './rootViewportNode.js';
import { RootViewportPresenter } from './RootViewportPresenter.js';
import { rootClassName } from '../stageClassName.js';
import { RunningGameScope } from '../contexts/EditorHintContext.js';

export function GameView({ className }: { className?: string }) {
  const frameloop = usePreviewFrameloop();
  return (
    <div className={rootClassName(className)}>
      <Canvas {...CANVAS_RENDERER_PROPS} gl={CANVAS_RENDERER_GL} frameloop={frameloop}>
        <CanvasRendererScope>
          <GameViewContents />
        </CanvasRendererScope>
      </Canvas>
    </div>
  );
}

/** The root viewport and its presenter, exported so the test renderer can mount it with no `<Canvas>`. */
export function GameViewContents() {
  return (
    <RunningGameScope>
      <RootViewport />
    </RunningGameScope>
  );
}

function RootViewport() {
  const sceneGraph = useOptionalHierarchy()?.sceneGraph ?? null;
  const rootScene = sceneGraph?.scenes.get(sceneGraph.rootScene);
  const nodes = useSeatedRoots() ?? null;
  const { settings } = useProjectSettings();
  const root = useMemo(() => rootViewportNode(settings, nodes ? [...nodes] : []), [settings, nodes]);
  const description = useMemo(() => gameViewportDescription(settings), [settings]);
  if (!nodes || !rootScene) return <RootViewportPresenter root={root} />;
  return (
    <SceneResourcesProvider
      internalResources={rootScene.internalResources}
      externalResources={rootScene.externalResources}
    >
      <EditedRootProvider editableInstances={rootScene.editableInstances}>
        <ViewportMount node={root} description={description}>
          <NodeDispatcher nodes={nodes} />
        </ViewportMount>
        <ControlRasterLayer
          nodes={[root]}
          internalResources={rootScene.internalResources}
          externalResources={rootScene.externalResources}
        />
      </EditedRootProvider>
      <RootViewportPresenter root={root} />
    </SceneResourcesProvider>
  );
}
