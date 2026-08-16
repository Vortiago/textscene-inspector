/**
 * The scope a `CanvasLayer` subtree draws in: its own canvas, not the world's.
 *
 * Four facts, published together because they ARE "this subtree is its own
 * canvas" — splitting them across call sites is what let one ship without the
 * others:
 *
 * - **CanvasModulate** is per canvas, so the world's does not reach in and one
 *   inside tints only this layer.
 * - **Inherited modulate resets to white.** `CanvasLayer` derives from `Node`,
 *   so `get_parent_item()` returns null under it (`scene/main/canvas_item.cpp:565`),
 *   the child attaches to this layer's own canvas RID (`canvas_item.cpp:264,269`),
 *   and every canvas seeds its root items white
 *   (`servers/rendering/renderer_canvas_cull.cpp:82`). Visibility crosses only
 *   because `scene/main/canvas_layer.cpp:57-63` propagates it by hand; colour
 *   has no equivalent.
 * - **The layer index** decides which 2D lights reach the subtree: a light is
 *   handed to a canvas only when the canvas's layer falls in its
 *   `range_layer_min/max` window, default 0..0, against a layer's own default 1.
 * - **z accumulation restarts at 0**, because `_cull_canvas_item` walks each
 *   canvas from 0.
 *
 * Takes the NODE, never the derived values: the two call sites (`NodeDispatcher`
 * for the Node2D walk, the `CanvasLayer` painter for the Control walk) each
 * derived them separately before, which is exactly how they drift.
 */
import { useMemo, type ReactNode } from 'react';
import type { TscnNode } from '../parser/types.js';
import { canvasLayerOf } from './canvasPaintOrder.js';
import { canvasModulateColor, CanvasModulateContext } from './canvasModulate.js';
import { Modulate2DContext, WHITE_MODULATE } from './canvasItemModulate.js';
import { CanvasLayerIndexProvider, EffectiveZProvider } from './lighting2d/canvasItemPlacement.js';

export function CanvasLayerScope({ node, children }: { node: TscnNode; children: ReactNode }) {
  const modulate = useMemo(() => canvasModulateColor(node.children), [node.children]);

  return (
    <CanvasModulateContext.Provider value={modulate}>
      <Modulate2DContext.Provider value={WHITE_MODULATE}>
        <CanvasLayerIndexProvider value={canvasLayerOf(node)}>
          <EffectiveZProvider value={0}>{children}</EffectiveZProvider>
        </CanvasLayerIndexProvider>
      </Modulate2DContext.Provider>
    </CanvasModulateContext.Provider>
  );
}
