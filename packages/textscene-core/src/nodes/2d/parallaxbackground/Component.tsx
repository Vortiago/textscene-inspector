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
import { parallaxLayerDelta, parallaxLayerPose, parallaxScroll } from './parallaxScroll';
import { currentCameraFraming } from './currentCameraFraming';
import { observeSceneCamera } from '../../../r3f/sceneRenderCamera';
import { ParallaxScrollProvider, type RegisteredParallaxLayer } from './scrollContext';
import type { ParallaxBackgroundProperties } from './types';

export function ParallaxBackground({ node, children }: NodeComponentProps) {
  const props = node.properties as ParallaxBackgroundProperties;
  const path = useNodePath() ?? node.name;
  const scene = useThree((state) => state.scene);

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

      // With no current Camera2D, `set_base_offset_and_scale` never runs and the
      // layers keep their authored pose: `_update_scroll` early-returns outside the
      // tree, and a `.tscn` applies properties before `add_child`.
      const view = currentCameraFraming(scene, camera);
      const scroll = view ? parallaxScroll(props, view) : null;
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
  }, [scene, props, layers]);

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
