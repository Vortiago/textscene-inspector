/**
 * The 2D-world layer of the Canvas2DStage (ADR-0006, Godot-parity amendment):
 * a transparent orthographic R3F canvas rendering the scene's CanvasItem
 * content (sprites, tilemaps, Node2D trees) underneath the Control DOM
 * overlay — together they mirror Godot's 2D editor, which composites the
 * whole CanvasItem world in one view. The camera tracks the stage's pan/zoom
 * (world2DCamera math) so canvas pixels line up exactly with the overlay
 * frame. Pointer events pass through to the stage (pan/zoom drag).
 *
 * `World2DContents` is exported separately so @react-three/test-renderer can
 * exercise the scene part without a DOM `<Canvas>` host (the TscnSceneContents
 * pattern).
 *
 * `nativeControls` (the dev-only `useNativeControls` flag) mounts a native
 * Control layer as a sibling right after `<NodeDispatcher>`. `Canvas2DStage`
 * decides whether that or the DOM overlay is active — never both — this
 * canvas only obeys the prop it is handed.
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

// The native Control layer is lazy-loaded through the SAME barrel as
// the DOM `<ControlOverlay>` (see the lazy() in `Canvas2DStage.tsx`) — the
// barrel's side-effect imports are what register every Control type, so a
// direct import of the component file would silently unregister them all.
// Development-only (`useNativeControls`, off by default): this keeps its 17+
// registrations out of the 2D canvas's initial bundle for everyone who never
// flips the flag.
const ControlCanvasLayer = lazy(() =>
  import('../../controls/index.js').then((m) => ({ default: m.ControlCanvasLayer }))
);

export interface World2DCanvasProps {
  nodes: readonly TscnNode[];
  internalResources: readonly TscnInternalResource[];
  externalResources: readonly TscnExternalResource[];
  pan: { x: number; y: number };
  zoom: number;
  /**
   * Mount the native (WebGL) Control layer as a sibling of `<NodeDispatcher>`
   * instead of leaving Control drawing to the DOM `<ControlOverlay>`
   * (`Canvas2DStage`, dev-only `useNativeControls` flag). Still missing every
   * per-type painter (an unregistered type draws `<ControlFallback>`'s
   * outline) and the ordered viewport-pass driver for nested SubViewports —
   * those land in later packets.
   */
  nativeControls?: boolean;
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
  nativeControls,
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
          {nativeControls && (
            // `null`, never a DOM element: this Suspense boundary lives inside
            // the R3F reconciler's tree, which has no host to mount a `<div>`
            // fallback on — unlike Canvas2DStage's DOM ControlOverlay Suspense.
            // Inside the lighting provider because a Control is a CanvasItem
            // like any other, so a 2D light reaches it.
            <Suspense fallback={null}>
              <ControlCanvasLayer nodes={nodes} />
            </Suspense>
          )}
        </CanvasLighting2DProvider>
      </SceneResourcesProvider>
    </CanvasWorkspaceProvider>
  );
}

export function World2DCanvas(props: World2DCanvasProps) {
  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 1000], near: 0.1, far: 4000 }}
      gl={{ alpha: true }}
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
