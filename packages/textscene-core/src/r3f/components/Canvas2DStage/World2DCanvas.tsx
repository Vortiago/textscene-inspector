/**
 * The 2D-world layer of the Canvas2DStage (ADR-0006, Godot-parity amendment):
 * a transparent orthographic R3F canvas rendering the scene's CanvasItem
 * content (sprites, tilemaps, Node2D trees) and, as a sibling, the native
 * Control canvas — together they mirror Godot's 2D editor, which composites
 * the whole CanvasItem world in one view. The camera tracks the stage's
 * pan/zoom (world2DCamera math) so canvas pixels line up exactly with the
 * capture frame. Pointer events pass through to the stage (pan/zoom drag).
 *
 * `World2DContents` is exported separately so @react-three/test-renderer can
 * exercise the scene part without a DOM `<Canvas>` host (the TscnSceneContents
 * pattern).
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

// The native Control layer is lazy-loaded through the controls barrel — its
// side-effect imports are what register every Control type, so a direct
// import of the component file would silently unregister them all. Lazy so
// its 23 registrations stay out of the 2D canvas's initial bundle until a
// stage that actually renders Controls asks for them.
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
        {/* The light accumulator starts from the canvas tint, so it needs the
            same colour the dispatcher publishes to the items — the one pure
            function of `nodes` is the shared definition of it. */}
        <CanvasLighting2DProvider canvasModulate={canvasModulate}>
          <NodeDispatcher nodes={nodes} />
          {/* `null`, never a DOM element: this Suspense boundary lives inside
              the R3F reconciler's tree, which has no host to mount a `<div>`
              fallback on. Inside the lighting provider because a Control is a
              CanvasItem like any other, so a 2D light reaches it. */}
          <Suspense fallback={null}>
            <ControlCanvasLayer nodes={nodes} />
          </Suspense>
          {/* A `SubViewportContainer` (or another `ViewportTexture` consumer)
              may be sampling its target whoever draws the on-screen Controls. */}
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
      // `localClippingEnabled` — ScrollContainer's native clip planes
      // (`r3f/controls/native/controlClipping.tsx`) are per-material state
      // three otherwise silently ignores: a spike verified stencil was never
      // viable here (this canvas requests no stencil buffer at all), so
      // planes are the only mechanism, and this flag is what turns them on.
      //
      // `antialias: false` — scene/main/viewport.h:309 `msaa_2d =
      // MSAA_DISABLED`. A 2D canvas samples one pixel centre; soft edges are
      // authored geometry (style_box_flat.cpp:555-629), so MSAA ramps them twice.
      gl={{ alpha: true, localClippingEnabled: true, antialias: false }}
      // Godot never tone-maps a canvas: the RD renderer runs
      // `_render_buffers_post_process_and_tonemap` on the 3D buffers and
      // composites canvas items into the viewport AFTER it, so authored 2D
      // colour reaches the framebuffer as written. `flat` = `NoToneMapping`;
      // without it @react-three/fiber defaults to ACES Filmic, which lifted
      // highlights and desaturated every fill in this stage.
      //
      // It reaches further than the stage's own content: a viewport surface
      // only ever exists in this workspace, so the default also applied to the
      // offscreen pass of a container's 3D sub-viewport, which the
      // `SubViewport` component deliberately leaves on the renderer's live
      // curve. This is the one
      // canvas where "the parent viewport's curve" has no Environment behind
      // it, so the honest curve is none.
      flat
      // Fill the stage and stay transparent to pointer input so the stage's
      // own drag-to-pan / wheel-to-zoom handlers keep working.
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <World2DContents {...props} />
    </Canvas>
  );
}
