/**
 * The scope a `CanvasLayer` subtree draws in: its own canvas. It takes the node,
 * not derived values, so the Node2D walk (`NodeDispatcher`) and the Control walk's
 * `CanvasLayer` painter publish the same four facts.
 */
import { useMemo, type ReactNode } from 'react';
import type { TscnNode } from '../parser/types.js';
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

  // The layer index picks the 2D lights: a light reaches a canvas whose layer is
  // in its `range_layer_min/max`, default 0..0, where a layer defaults to 1. z
  // restarts at 0, since `_cull_canvas_item` walks each canvas from 0.
  return (
    <CanvasModulateContext.Provider value={modulate}>
      <Modulate2DContext.Provider value={WHITE_MODULATE}>
        <TextureSampler2DContext.Provider value={ROOT_TEXTURE_SAMPLER}>
          <CanvasLayerIndexProvider value={canvasLayerOf(node)}>
            <EffectiveZProvider value={0}>{children}</EffectiveZProvider>
          </CanvasLayerIndexProvider>
        </TextureSampler2DContext.Provider>
      </Modulate2DContext.Provider>
    </CanvasModulateContext.Provider>
  );
}
