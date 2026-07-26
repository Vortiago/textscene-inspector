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
 */

import { useLayoutEffect } from 'react';
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
  return (
    <CanvasWorkspaceProvider workspace="2d">
      <SceneResourcesProvider
        internalResources={internalResources}
        externalResources={externalResources}
      >
        <CameraRig pan={pan} zoom={zoom} />
        <NodeDispatcher nodes={nodes} />
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
      // Godot never tone-maps a canvas: authored 2D colour goes straight to the
      // framebuffer, and only the 3D pass is tone-mapped. R3F otherwise
      // defaults to ACESFilmic, which lifted highlights and desaturated every
      // fill in this stage.
      flat
      // Fill the stage and stay transparent to pointer input so the stage's
      // own drag-to-pan / wheel-to-zoom handlers keep working.
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <World2DContents {...props} />
    </Canvas>
  );
}
