/**
 * The scope a `CanvasLayer` subtree draws in: its own canvas. It takes the node,
 * not derived values, so the Node2D walk (`NodeDispatcher`) and the Control walk's
 * `CanvasLayer` painter publish the same four facts and the same canvas transform.
 */
import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { TscnNode } from '../parser/types.js';
import type { Transform2DColumns } from '../godot/transform2d.js';
import { threeMatrixFromTransform2D } from './node2dTransform.js';
import { canvasLayerOf } from './canvasPaintOrder.js';
import { canvasModulateColor, CanvasModulateContext } from './canvasModulate.js';
import { Modulate2DContext, WHITE_MODULATE } from './canvasItemModulate.js';
import { ROOT_TEXTURE_SAMPLER, TextureSampler2DContext } from './canvasItemTextureSampler.js';
import { CanvasLayerIndexProvider, EffectiveZProvider } from './lighting2d/canvasItemPlacement.js';
import { observeSceneCamera } from './sceneRenderCamera.js';
import { viewportLayerMatrix, type ViewportLayerFollow } from './viewportLayerAnchor.js';

/**
 * Places `layer` for each render of the scene. A render through a camera other than the store's is
 * a sub-viewport's pass, the only surface with a Godot canvas transform: the 2D stage draws through
 * a free camera with none, as Godot's editor does, and leaves the layer unanchored.
 */
function useViewportLayerAnchor(layer: RefObject<THREE.Object3D | null>, follow: ViewportLayerFollow): void {
  const scene = useThree((state) => state.scene);
  const storeCamera = useThree((state) => state.camera);
  const { enabled, scale } = follow;
  useEffect(() => {
    const size = new THREE.Vector2();
    const next = new THREE.Matrix4();
    return observeSceneCamera(scene, (camera, target) => {
      const object = layer.current;
      if (!object) return;
      const ortho = camera as THREE.OrthographicCamera;
      if (camera === storeCamera || !target || !ortho.isOrthographicCamera) next.identity();
      else viewportLayerMatrix({ enabled, scale }, ortho, size.set(target.width, target.height), next);
      if (next.equals(object.matrix)) return;
      object.matrix.copy(next);
      // `onBeforeRender` runs after the scene's own matrix update, so the subtree is refreshed here.
      object.updateMatrixWorld(true);
    });
  }, [scene, storeCamera, layer, enabled, scale]);
}

/**
 * Under a `CanvasLayer`, a `Node`, `get_parent_item()` returns null
 * (`scene/main/canvas_item.cpp:565`): the child attaches to the layer's canvas RID
 * (`canvas_item.cpp:264,269`), so inherited modulate restarts white
 * (`servers/rendering/renderer_canvas_cull.cpp:82`) and the sampler at the root default.
 */
export function CanvasLayerScope({ node, children }: { node: TscnNode; children: ReactNode }) {
  // A CanvasModulate is per canvas: the world's stays out, and one inside tints
  // only this layer. The texture caches test the same null `parent_item`
  // (`canvas_item.cpp:1625-1699`). Visibility crosses only because
  // `scene/main/canvas_layer.cpp:57-63` propagates it by hand.
  const modulate = useMemo(() => canvasModulateColor(node.children), [node.children]);
  // Godot draws a layer's canvas through the layer's transform (`renderer_viewport.cpp:70-74`),
  // under the anchor a sub-viewport pass through a Camera2D sets.
  const { canvasTransform, follow_viewport_enabled, follow_viewport_scale } = node.properties as {
    canvasTransform: Transform2DColumns;
    follow_viewport_enabled: boolean;
    follow_viewport_scale: number;
  };
  const matrix = useMemo(() => threeMatrixFromTransform2D(canvasTransform), [canvasTransform]);
  const anchor = useRef<THREE.Object3D>(null);
  useViewportLayerAnchor(anchor, { enabled: follow_viewport_enabled, scale: follow_viewport_scale });

  // The layer index picks the 2D lights: a light reaches a canvas whose layer is
  // in its `range_layer_min/max`, default 0..0, where a layer defaults to 1. z
  // restarts at 0, since `_cull_canvas_item` walks each canvas from 0.
  return (
    <CanvasModulateContext.Provider value={modulate}>
      <Modulate2DContext.Provider value={WHITE_MODULATE}>
        <TextureSampler2DContext.Provider value={ROOT_TEXTURE_SAMPLER}>
          <CanvasLayerIndexProvider value={canvasLayerOf(node)}>
            <EffectiveZProvider value={0}>
              {/* Object3Ds, not Groups: three takes `groupOrder` from the nearest Group, so these
                  reset no canvas key. */}
              <object3D ref={anchor} matrixAutoUpdate={false}>
                <object3D matrix={matrix} matrixAutoUpdate={false}>
                  {children}
                </object3D>
              </object3D>
            </EffectiveZProvider>
          </CanvasLayerIndexProvider>
        </TextureSampler2DContext.Provider>
      </Modulate2DContext.Provider>
    </CanvasModulateContext.Provider>
  );
}
