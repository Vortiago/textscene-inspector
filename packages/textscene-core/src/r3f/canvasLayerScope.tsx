/**
 * The scope a `CanvasLayer` subtree draws in: its own canvas. It takes the node,
 * not derived values, so the Node2D walk (`NodeDispatcher`) and the Control walk's
 * `CanvasLayer` painter publish the same four facts and the same canvas transform.
 */
import { useMemo, type ReactNode } from 'react';
import type { TscnNode } from '../parser/types.js';
import type { Transform2DColumns } from '../godot/transform2d.js';
import { threeMatrixFromTransform2D } from './node2dTransform.js';
import { canvasLayerOf } from './canvasPaintOrder.js';
import { canvasModulateColor, CanvasModulateContext } from './canvasModulate.js';
import { Modulate2DContext, WHITE_MODULATE } from './canvasItemModulate.js';
import { ROOT_TEXTURE_SAMPLER, TextureSampler2DContext } from './canvasItemTextureSampler.js';
import { CanvasLayerIndexProvider, EffectiveZProvider } from './lighting2d/canvasItemPlacement.js';

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
  // The editor draws a layer's canvas through its view times the layer's transform
  // (`renderer_viewport.cpp:70-74`). The editor turns the follow-viewport scale off
  // (`canvas_item_editor_plugin.cpp:6749`), and its world canvas has no Camera2D transform, so
  // `follow_viewport_*` changes nothing here.
  const { canvasTransform } = node.properties as { canvasTransform: Transform2DColumns };
  const matrix = useMemo(() => threeMatrixFromTransform2D(canvasTransform), [canvasTransform]);

  // The layer index picks the 2D lights: a light reaches a canvas whose layer is
  // in its `range_layer_min/max`, default 0..0, where a layer defaults to 1. z
  // restarts at 0, since `_cull_canvas_item` walks each canvas from 0.
  return (
    <CanvasModulateContext.Provider value={modulate}>
      <Modulate2DContext.Provider value={WHITE_MODULATE}>
        <TextureSampler2DContext.Provider value={ROOT_TEXTURE_SAMPLER}>
          <CanvasLayerIndexProvider value={canvasLayerOf(node)}>
            <EffectiveZProvider value={0}>
              {/* An Object3D, not a Group: three takes `groupOrder` from the nearest Group, so this
                  resets no canvas key. */}
              <object3D matrix={matrix} matrixAutoUpdate={false}>
                {children}
              </object3D>
            </EffectiveZProvider>
          </CanvasLayerIndexProvider>
        </TextureSampler2DContext.Provider>
      </Modulate2DContext.Provider>
    </CanvasModulateContext.Provider>
  );
}
