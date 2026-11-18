import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { useOptionalHierarchy } from '../contexts/HierarchyContext.js';
import { useSeatedRoots } from '../useLiveSceneTree.js';
import { useProjectSettings } from '../contexts/ProjectSettingsContext.js';
import { SceneResourcesProvider } from '../SceneResourcesContext.js';
import { EditedRootProvider } from '../contexts/InstanceOwnersContext.js';
import { NodeDispatcher } from '../NodeDispatcher.js';
import { ViewportMount } from '../../nodes/viewport/subviewport/Component.js';
import { ControlRasterLayer } from '../../nodes/viewport/subviewport/ControlRasterLayer.js';
import { gameViewportDescription } from '../viewportRender/viewportDescription.js';
import { rootViewportNode } from './rootViewportNode.js';
import { RootViewportPresenter } from './RootViewportPresenter.js';
import { rootWindow, shrinkRootWindow, type RootWindow } from './rootWindow.js';
import { paneScale } from './windowFit.js';
import { RunningGameScope } from '../contexts/EditorHintContext.js';

/** The root viewport and its presenter, as the game view's `<Canvas>` holds them. */
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
  const nodes = useSeatedRoots();
  const { settings } = useProjectSettings();
  const projectWindow = useMemo(() => rootWindow(settings), [settings]);
  const drawnWindow = useDrawnWindow(projectWindow);
  const root = useMemo(
    () => rootViewportNode(settings, drawnWindow, nodes ? [...nodes] : []),
    [settings, drawnWindow, nodes]
  );
  const rasterRoots = useMemo(() => [root], [root]);
  const description = useMemo(() => gameViewportDescription(settings), [settings]);
  return (
    <>
      {nodes && rootScene && (
        <SceneResourcesProvider
          internalResources={rootScene.internalResources}
          externalResources={rootScene.externalResources}
        >
          <EditedRootProvider editableInstances={rootScene.editableInstances}>
            <ViewportMount node={root} description={description}>
              <NodeDispatcher nodes={nodes} />
            </ViewportMount>
            <ControlRasterLayer
              nodes={rasterRoots}
              internalResources={rootScene.internalResources}
              externalResources={rootScene.externalResources}
            />
          </EditedRootProvider>
        </SceneResourcesProvider>
      )}
      <RootViewportPresenter root={root} projectWindow={projectWindow} />
    </>
  );
}

/** A pane smaller than the window renders the target at the fitted size. */
function useDrawnWindow(projectWindow: RootWindow): RootWindow {
  const pane = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);
  const scale = paneScale({ x: pane.width * dpr, y: pane.height * dpr }, projectWindow.size);
  return useMemo(() => shrinkRootWindow(projectWindow, scale), [projectWindow, scale]);
}
