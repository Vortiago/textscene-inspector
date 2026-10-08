/**
 * Draws a ParallaxBackground, a CanvasLayer, in viewport screen space: the subtree
 * ignores ancestor transforms, and `CanvasLayerScope` anchors it to a Camera2D's view.
 * The cut is an identity `matrixWorld` with `matrixWorldAutoUpdate` off: three keeps
 * it and still recomputes the subtree.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { CanvasSpaceProvider } from '../../../r3f/canvasRootScope';
import { Camera2DAnchorMode } from '../camera2d/types';
import type { Camera2DTag } from '../camera2d/cameraView';
import { selectViewportCamera2D } from '../../viewport/subviewport/offscreenViewport';
import {
  parallaxLayerDelta,
  parallaxLayerPose,
  parallaxScroll,
  parallaxViewFraming,
  type ParallaxViewFraming,
} from './parallaxScroll';
import { isViewportPass, observeSceneCamera } from '../../../r3f/sceneRenderCamera';
import { ParallaxScrollProvider, type RegisteredParallaxLayer } from './scrollContext';
import type { ParallaxBackgroundProperties } from './types';

/** The identity canvas transform: a view whose top-left is the world origin. */
const EDITOR_VIEW: ParallaxViewFraming = {
  topLeft: { x: 0, y: 0 },
  size: { x: 0, y: 0 },
  zoom: 1,
  centered: true,
};

export function ParallaxBackground({ node, children }: NodeComponentProps) {
  const props = node.properties as ParallaxBackgroundProperties;
  const path = useNodePath() ?? node.name;
  const scene = useThree((state) => state.scene);
  const storeCamera = useThree((state) => state.camera);

  const groupRef = useRef<THREE.Group>(null);
  const layers = useRef(new Map<string, RegisteredParallaxLayer>()).current;

  const register = useCallback(
    (layerPath: string, layer: RegisteredParallaxLayer) => {
      layers.set(layerPath, layer);
      return () => {
        if (layers.get(layerPath) === layer) layers.delete(layerPath);
      };
    },
    [layers]
  );
  const registry = useMemo(() => ({ parentPath: path, register }), [path, register]);

  useEffect(() => {
    return observeSceneCamera(scene, (camera) => {
      const group = groupRef.current;
      if (!group) return;

      const viewportPass = isViewportPass(camera, storeCamera);
      const ortho = camera as THREE.OrthographicCamera;

      // Godot's `__cameras_<viewport>` group scope: the current Camera2D of this
      // viewport, which for an offscreen pass is the scene being drawn.
      const camera2d = viewportPass ? selectViewportCamera2D(scene) : null;
      const tag = camera2d?.userData.camera2d as Camera2DTag | undefined;

      const view =
        viewportPass && tag
          ? parallaxViewFraming(
              {
                left: ortho.left,
                right: ortho.right,
                top: ortho.top,
                bottom: ortho.bottom,
                x: ortho.position.x,
                y: ortho.position.y,
                zoom: ortho.zoom,
              },
              tag.zoom.x || 1,
              tag.anchor_mode !== Camera2DAnchorMode.FIXED_TOP_LEFT
            )
          : EDITOR_VIEW;

      // With no current Camera2D, `set_base_offset_and_scale` never runs and the
      // layers keep their authored pose: `_update_scroll` early-returns outside the
      // tree, and a `.tscn` applies properties before `add_child`.
      const scroll = tag ? parallaxScroll(props, view) : null;
      for (const layer of layers.values()) {
        if (!scroll) {
          layer.group.position.set(0, 0, 0);
          layer.group.scale.set(1, 1, 1);
          continue;
        }
        const delta = parallaxLayerDelta(parallaxLayerPose(layer.motion, layer.origin, scroll), layer.origin);
        layer.group.position.set(delta.position.x, 0 - delta.position.y, 0);
        layer.group.scale.set(delta.scale, delta.scale, 1);
      }

      // Written before the renderer builds its list, so the poses above and the
      // cut chain take effect in this frame, not the next.
      group.updateMatrixWorld(true);
    });
  }, [scene, storeCamera, props, layers]);

  return (
    <ParallaxScrollProvider value={registry}>
      {/* paint-order-safe: `layer` (default -100) is a canvas, not a draw order
          within one. It reaches the key as a layer rank through `isCanvasLayerType`
          (`canvasPaintOrder.ts`), and each canvas item carries its own key. */}
      <group
        ref={groupRef}
        name={node.name}
        visible={props.visible !== false}
        matrixAutoUpdate={false}
        matrixWorldAutoUpdate={false}
      >
        {/* The chain is cut here, so a canvas root inside must cancel nothing:
            the accumulated CanvasItem transform restarts at this group. */}
        <CanvasSpaceProvider value={null}>{children}</CanvasSpaceProvider>
      </group>
    </ParallaxScrollProvider>
  );
}
