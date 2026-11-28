/**
 * What the 2D-world canvas draws: the CanvasItem world and the native Control canvas in one
 * orthographic view, with a camera that tracks the stage's pan and zoom. `World2DCanvas` mounts
 * it inside its `<Canvas>`.
 */

import { lazy, useLayoutEffect, useState, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import type { OrthographicCamera } from 'three';
import type { TscnNode, TscnExternalResource, TscnInternalResource } from '../../parser/types.js';
import { CanvasWorkspaceProvider } from '../contexts/CanvasWorkspaceContext.js';
import { EditedRootProvider } from '../contexts/InstanceOwnersContext.js';
import { SceneResourcesProvider } from '../SceneResourcesContext.js';
import { useDispatchRoots } from '../contexts/HierarchyContext.js';
import { NodeDispatcher } from '../NodeDispatcher.js';
import { CanvasWorldScope } from '../environment/WorldEnvironmentScope.js';
import { world2DCameraPose } from './world2DCamera.js';
import type { StageView } from './stageView.js';
import type { ExternalStore } from '../../utils/externalStore.js';
import { useExternalStoreValue } from '../hooks/createExternalStore.js';
import { CanvasLighting2DProvider } from '../lighting2d/CanvasLighting2D.js';
import { useCanvasModulateColor } from '../canvasModulate.js';
import { ControlRasterLayer } from '../../nodes/viewport/subviewport/ControlRasterLayer.js';
import { ProjectClearColor } from '../ProjectClearColor.js';
import { CanvasFrameRender } from './CanvasFrameRender.js';
import { CanvasFrameStepsContext, createCanvasFrameSteps } from './canvasFrameSequence.js';
import { PendingSuspense } from '../../resources/PendingSuspense.js';
import { useRootCanvasColorSpace } from '../rootCanvasColorSpace.js';
import { YSortProvider } from '../contexts/YSortContext.js';
import { CanvasRendererScope } from '../canvasRenderer/CanvasRendererScope.js';

// Through the controls barrel, whose side-effect imports register every Control
// type: the component file alone registers none. Lazy, so the registrations stay
// out of the initial bundle until a stage renders Controls.
const ControlCanvasLayer = lazy(() =>
  import('../controls/index.js').then((m) => ({ default: m.ControlCanvasLayer }))
);

export interface World2DCanvasProps {
  nodes: readonly TscnNode[];
  internalResources: readonly TscnInternalResource[];
  externalResources: readonly TscnExternalResource[];
  editableInstances?: readonly string[];
  /** Read outside React state, so a pan moves the camera without a render of the scene tree. */
  view: ExternalStore<StageView>;
  /** The 2D editor's own parts, which read the Controls the walk solves. */
  children?: ReactNode;
}

/** Keeps the ortho camera glued to the stage's pan/zoom transform. */
function CameraRig({ view }: { view: ExternalStore<StageView> }) {
  const camera = useThree((s) => s.camera) as OrthographicCamera;
  const size = useThree((s) => s.size);
  const {
    pan: { x: panX, y: panY },
    zoom,
  } = useExternalStoreValue(view);
  useLayoutEffect(() => {
    const pose = world2DCameraPose({ x: panX, y: panY }, zoom, size.width, size.height);
    camera.position.set(pose.x, pose.y, 1000);
    camera.zoom = pose.zoom;
    camera.updateProjectionMatrix();
  }, [camera, panX, panY, zoom, size.width, size.height]);
  return null;
}

export function World2DContents({
  nodes,
  internalResources,
  externalResources,
  editableInstances,
  view,
  children,
}: World2DCanvasProps) {
  const dispatchRoots = useDispatchRoots(nodes);
  const canvasModulate = useCanvasModulateColor(nodes);
  const canvasSpace = useRootCanvasColorSpace();
  const [frameSteps] = useState(createCanvasFrameSteps);
  return (
    <CanvasWorkspaceProvider workspace="2d">
      <CanvasRendererScope>
        <SceneResourcesProvider internalResources={internalResources} externalResources={externalResources}>
          <EditedRootProvider editableInstances={editableInstances}>
            <CameraRig view={view} />
            <ProjectClearColor />
            <CanvasFrameStepsContext.Provider value={frameSteps}>
              <CanvasFrameRender steps={frameSteps} />
              {/* The light accumulator starts from the canvas tint, the same pure
              function of `nodes` the dispatcher publishes to the items. */}
              <CanvasLighting2DProvider canvasModulate={canvasModulate} space={canvasSpace}>
                {/* One provider over both walks: a y-sorted node and the Controls beside it exchange origins and runs. */}
                <YSortProvider>
                  <CanvasWorldScope>
                    <NodeDispatcher nodes={dispatchRoots} />
                  </CanvasWorldScope>
                  {/* Inside the lighting provider, so a 2D light reaches a Control. */}
                  <PendingSuspense>
                    <ControlCanvasLayer nodes={nodes} />
                  </PendingSuspense>
                  {children}
                </YSortProvider>
                {/* A `ViewportTexture` consumer may sample its target whoever draws
                the on-screen Controls. */}
                <ControlRasterLayer
                  nodes={nodes}
                  internalResources={internalResources}
                  externalResources={externalResources}
                />
              </CanvasLighting2DProvider>
            </CanvasFrameStepsContext.Provider>
          </EditedRootProvider>
        </SceneResourcesProvider>
      </CanvasRendererScope>
    </CanvasWorkspaceProvider>
  );
}
