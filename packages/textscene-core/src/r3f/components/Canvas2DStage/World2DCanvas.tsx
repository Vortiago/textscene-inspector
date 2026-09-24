/**
 * The 2D-world layer of the Canvas2DStage (ADR-0006): a transparent orthographic
 * canvas that draws the CanvasItem world and the native Control canvas in one
 * view, as Godot's 2D editor does. Its camera tracks the stage's pan and zoom.
 * `World2DContents` is exported for @react-three/test-renderer.
 */

import { lazy, Suspense, useLayoutEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import type { OrthographicCamera } from 'three';
import type {
  TscnNode,
  TscnExternalResource,
  TscnInternalResource,
} from '../../../parser/types.js';
import { CanvasWorkspaceProvider } from '../../contexts/CanvasWorkspaceContext.js';
import { SceneResourcesProvider } from '../../SceneResourcesContext.js';
import { NodeDispatcher } from '../../NodeDispatcher.js';
import { world2DCameraPose } from './world2DCamera.js';
import { CanvasLighting2DProvider } from '../../lighting2d/CanvasLighting2D.js';
import { canvasModulateColor } from '../../canvasModulate.js';
import { ViewportPassOrchestrator } from '../../contexts/ViewportPassRegistryContext.js';
import { ControlRasterLayer } from '../../../nodes/viewport/subviewport/ControlRasterLayer.js';

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
  pan: { x: number; y: number };
  zoom: number;
}

/** Keeps the ortho camera glued to the stage's pan/zoom transform. */
function CameraRig({ pan, zoom }: { pan: { x: number; y: number }; zoom: number }) {
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
  pan,
  zoom,
}: World2DCanvasProps) {
  const canvasModulate = useMemo(() => canvasModulateColor(nodes), [nodes]);
  return (
    <CanvasWorkspaceProvider workspace="2d">
      <SceneResourcesProvider
        internalResources={internalResources}
        externalResources={externalResources}
      >
        <CameraRig pan={pan} zoom={zoom} />
        {/* The light accumulator starts from the canvas tint, the same pure
            function of `nodes` the dispatcher publishes to the items. */}
        <CanvasLighting2DProvider canvasModulate={canvasModulate}>
          <NodeDispatcher nodes={nodes} />
          {/* `null`: the R3F reconciler's tree has no host for a `<div>` fallback.
              Inside the lighting provider, so a 2D light reaches a Control. */}
          <Suspense fallback={null}>
            <ControlCanvasLayer nodes={nodes} />
          </Suspense>
          {/* A `ViewportTexture` consumer may sample its target whoever draws
              the on-screen Controls. */}
          <ControlRasterLayer
            nodes={nodes}
            internalResources={internalResources}
            externalResources={externalResources}
          />
        </CanvasLighting2DProvider>
      </SceneResourcesProvider>
      <ViewportPassOrchestrator />
    </CanvasWorkspaceProvider>
  );
}

export function World2DCanvas(props: World2DCanvasProps) {
  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 1000], near: 0.1, far: 4000 }}
      // Without `localClippingEnabled`, three ignores ScrollContainer's clip planes
      // (`r3f/controls/native/controlClipping.tsx`). This canvas has no stencil buffer.
      // `antialias: false`: scene/main/viewport.h:309 `msaa_2d = MSAA_DISABLED`.
      // Soft edges are authored geometry (style_box_flat.cpp:555-629), and MSAA ramps them twice.
      gl={{ alpha: true, localClippingEnabled: true, antialias: false }}
      // Godot composites canvas items after `_render_buffers_post_process_and_tonemap`,
      // so 2D colour is never tone-mapped. `flat` is `NoToneMapping`, not R3F's ACES.
      // It also covers a container's 3D sub-viewport pass, whose parent viewport
      // here has no Environment and so no curve.
      flat
      // Transparent to pointer input, so the stage's pan and zoom handlers work.
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <World2DContents {...props} />
    </Canvas>
  );
}
