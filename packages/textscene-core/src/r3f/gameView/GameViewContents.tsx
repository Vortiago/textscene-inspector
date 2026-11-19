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
import { useDrawnRootWindow, useProjectRootWindow } from './useDrawnRootWindow.js';
import { RunningGameScope } from '../contexts/EditorHintContext.js';
import { useGameViewReport } from './useGameViewReport.js';

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
  const projectWindow = useProjectRootWindow();
  const drawnWindow = useDrawnRootWindow(projectWindow);
  const root = useMemo(
    () => rootViewportNode(settings, drawnWindow, nodes ? [...nodes] : []),
    [settings, drawnWindow, nodes]
  );
  const rasterRoots = useMemo(() => [root], [root]);
  const { transparent_bg: isTransparent } = root.properties as SubViewportProperties;
  const description = useMemo(() => gameViewportDescription(settings), [settings]);
  const report = useGameViewReport(drawnWindow, projectWindow);
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
      <RootViewportPresenter
        projectWindow={projectWindow}
        drawnWindow={drawnWindow}
        isTransparent={isTransparent}
        onPresent={report}
      />
    </>
  );
}
