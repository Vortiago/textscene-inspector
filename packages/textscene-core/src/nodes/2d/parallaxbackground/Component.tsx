/**
 * <ParallaxBackground> — a CanvasLayer, so its subtree is laid out in the
 * VIEWPORT's screen space, not under its parent node's transform.
 *
 * Two things follow, and both are what the plain-Node2D fallback got wrong:
 *
 * 1. **The ancestor transform chain is cut.** Godot attaches a CanvasLayer's
 *    canvas to the viewport and gives it `get_final_transform()` — its own
 *    offset/rotation/scale and nothing else — so a background under a displaced
 *    `Level` node does not inherit that displacement. Here that is
 *    `matrixWorldAutoUpdate = false` plus a world matrix written directly:
 *    three then leaves this object's `matrixWorld` alone and still recomputes
 *    the subtree from it.
 * 2. **The subtree anchors to the view, not the origin,** whenever the viewport
 *    draws through a Camera2D. That anchor is the view rect's top-left, which is
 *    exactly what makes a background cover the screen wherever the camera moves;
 *    without it the art stays at a fixed world position and the view slides off
 *    its bottom edge.
 *
 * `layer` (which `ParallaxBackground` defaults to -100, "behind all by default")
 * becomes `renderOrder` on the subtree. Every 2D canvas material in the repo is
 * `transparent` with `depthWrite = false`, so three orders them by `renderOrder`
 * first and depth second — which is the same precedence Godot gives a canvas
 * layer over a canvas item's `z_index`.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { node2dGroupProps } from '../../../r3f/node2dTransform';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
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
import { observeSceneCamera } from './sceneRenderCamera';
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
  // The camera the R3F store renders this canvas through. A render that uses a
  // DIFFERENT one is a sub-viewport's offscreen pass, which is the only surface
  // here that carries a Godot canvas transform.
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

  // The CanvasLayer's own placement, in three space. Rebuilt only when the
  // parsed surface changes — it depends on nothing dynamic.
  const canvasMatrix = useMemo(() => {
    const t = node2dGroupProps({
      position: props.offset,
      rotation: props.rotation,
      scale: props.scale,
    });
    return new THREE.Matrix4().compose(
      new THREE.Vector3(...t.position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...t.rotation)),
      new THREE.Vector3(...t.scale)
    );
  }, [props.offset, props.rotation, props.scale]);

  useEffect(() => {
    const anchor = new THREE.Matrix4();
    const world = new THREE.Matrix4();

    return observeSceneCamera(scene, (camera) => {
      const group = groupRef.current;
      if (!group) return;

      const ortho = camera as THREE.OrthographicCamera;
      const viewportPass = camera !== storeCamera && ortho.isOrthographicCamera === true;

      // Godot's `__cameras_<viewport>` group scope: the current Camera2D of THIS
      // viewport, which for an offscreen pass is exactly the scene being drawn.
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

      // `follow_viewport_enabled` re-parents the layer's canvas onto the world
      // canvas (`canvas_set_parent`), which cancels the screen anchor: the
      // subtree then lands at the scroll offset in WORLD space.
      const anchorX = props.follow_viewport_enabled ? 0 : view.topLeft.x;
      const anchorY = props.follow_viewport_enabled ? 0 : view.topLeft.y;
      anchor.makeTranslation(anchorX, 0 - anchorY, 0);
      world.multiplyMatrices(anchor, canvasMatrix);
      group.matrixWorld.copy(world);

      // No current Camera2D means `set_base_offset_and_scale` never runs and the
      // layers keep the pose they were authored with — Godot's own load-time
      // behaviour, not an approximation of it.
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
      // cut chain both take effect in THIS frame rather than the next.
      group.updateMatrixWorld(true);
    });
  }, [scene, storeCamera, props, canvasMatrix, layers]);

  return (
    <ParallaxScrollProvider value={registry}>
      {/* paint-order-safe: `ParallaxBackground extends CanvasLayer`, so its
          `layer` is a CANVAS, not a draw order within one — it reaches the key
          as a layer RANK via `CANVAS_LAYER_TYPES` (`canvasPaintOrder.ts`), and
          each canvas item inside carries its own key on its own wrapper. This
          used to be a per-frame `traverse` writing `props.layer` onto every
          object in the subtree, which flattened all of them onto one value. */}
      <group
        ref={groupRef}
        name={node.name}
        visible={props.visible !== false}
        matrixAutoUpdate={false}
        matrixWorldAutoUpdate={false}
      >
        {children}
      </group>
    </ParallaxScrollProvider>
  );
}
