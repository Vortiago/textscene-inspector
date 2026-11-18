import { useMemo } from 'react';
import { useOptionalHierarchy } from '../contexts/HierarchyContext.js';
import { useSeatedRoots } from '../useLiveSceneTree.js';
import { useProjectSettings } from '../contexts/ProjectSettingsContext.js';
import { SceneResourcesProvider } from '../SceneResourcesContext.js';
import { EditedRootProvider } from '../contexts/InstanceOwnersContext.js';
import { NodeDispatcher } from '../NodeDispatcher.js';
import type { SubViewportProperties } from '../../nodes/viewport/subviewport/types.js';
import { ViewportMount } from '../../nodes/viewport/subviewport/Component.js';
import { ControlRasterLayer } from '../../nodes/viewport/subviewport/ControlRasterLayer.js';
import { gameViewportDescription } from '../viewportRender/viewportDescription.js';
import { rootViewportNode } from './rootViewportNode.js';
import { RootViewportPresenter } from './RootViewportPresenter.js';
import { fittedTargetSize, rootWindow, shrinkRootWindow, type RootWindow } from './rootWindow.js';
import { useDrawingBufferSize } from '../useDrawingBufferSize.js';
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
  const { transparent_bg: isTransparent } = root.properties as SubViewportProperties;
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
      <RootViewportPresenter projectWindow={projectWindow} isTransparent={isTransparent} />
    </>
  );
}

/** A smaller pane renders the target at the fitted size, rebuilt only as its pixels change. */
function useDrawnWindow(projectWindow: RootWindow): RootWindow {
  const pane = useDrawingBufferSize();
  const scale = paneScale({ x: pane.width, y: pane.height }, projectWindow.size);
  const { x, y } = fittedTargetSize(projectWindow, scale);
  return useMemo(() => shrinkRootWindow(projectWindow, { x, y }), [projectWindow, x, y]);
}
