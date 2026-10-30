/**
 * What the 2D-world canvas draws: the CanvasItem world and the native Control canvas in one
 * orthographic view, with a camera that tracks the stage's pan and zoom. `World2DCanvas` mounts
 * it inside its `<Canvas>`.
 */

import { lazy, useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type { OrthographicCamera } from 'three';
import type { TscnNode, TscnExternalResource, TscnInternalResource } from '../../../parser/types.js';
import type { Vector2 } from '../../../godot/math/vector.js';
import { CanvasWorkspaceProvider } from '../../contexts/CanvasWorkspaceContext.js';
import { EditedRootProvider } from '../../contexts/InstanceOwnersContext.js';
import { SceneResourcesProvider } from '../../SceneResourcesContext.js';
import { NodeDispatcher } from '../../NodeDispatcher.js';
import { CanvasWorldScope } from '../../environment/WorldEnvironmentScope.js';
import { world2DCameraPose } from './world2DCamera.js';
import { CanvasLighting2DProvider } from '../../lighting2d/CanvasLighting2D.js';
import { useCanvasModulateColor } from '../../canvasModulate.js';
import { ViewportPassOrchestrator } from '../../contexts/ViewportPassRegistryContext.js';
import { ControlRasterLayer } from '../../../nodes/viewport/subviewport/ControlRasterLayer.js';
import { TiledUploadDriver } from '../../tiledUpload/TiledUploadDriver.js';
import { ProjectClearColor } from '../../ProjectClearColor.js';
import { CanvasFrameRender } from './CanvasFrameRender.js';
import { PendingSuspense } from '../../../resources/PendingSuspense.js';
import { ScreenshotBridge } from '../../ScreenshotBridge.js';

// Through the controls barrel, whose side-effect imports register every Control
// type: the component file alone registers none. Lazy, so the registrations stay
// out of the initial bundle until a stage renders Controls.
const ControlCanvasLayer = lazy(() =>
  import('../../controls/index.js').then((m) => ({ default: m.ControlCanvasLayer }))
);

export interface World2DCanvasProps {
  nodes: readonly TscnNode[];
  internalResources: readonly TscnInternalResource[];
  externalResources: readonly TscnExternalResource[];
  editableInstances?: readonly string[];
  pan: Vector2;
  zoom: number;
}

/** Keeps the ortho camera glued to the stage's pan/zoom transform. */
function CameraRig({ pan, zoom }: { pan: Vector2; zoom: number }) {
  const camera = useThree((s) => s.camera) as OrthographicCamera;
  const size = useThree((s) => s.size);
  const { x: panX, y: panY } = pan;
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
  pan,
  zoom,
}: World2DCanvasProps) {
  const canvasModulate = useCanvasModulateColor(nodes);
  return (
    <TiledUploadDriver>
      <CanvasWorkspaceProvider workspace="2d">
        <SceneResourcesProvider internalResources={internalResources} externalResources={externalResources}>
          <EditedRootProvider editableInstances={editableInstances}>
            <CameraRig pan={pan} zoom={zoom} />
            <ProjectClearColor />
            <CanvasFrameRender />
            {/* The light accumulator starts from the canvas tint, the same pure
              function of `nodes` the dispatcher publishes to the items. */}
            <CanvasLighting2DProvider canvasModulate={canvasModulate}>
              <CanvasWorldScope>
                <NodeDispatcher nodes={nodes} />
              </CanvasWorldScope>
              {/* Inside the lighting provider, so a 2D light reaches a Control. */}
              <PendingSuspense>
                <ControlCanvasLayer nodes={nodes} />
              </PendingSuspense>
              {/* A `ViewportTexture` consumer may sample its target whoever draws
                the on-screen Controls. */}
              <ControlRasterLayer
                nodes={nodes}
                internalResources={internalResources}
                externalResources={externalResources}
              />
            </CanvasLighting2DProvider>
          </EditedRootProvider>
        </SceneResourcesProvider>
        <ViewportPassOrchestrator />
        <ScreenshotBridge />
      </CanvasWorkspaceProvider>
    </TiledUploadDriver>
  );
}
