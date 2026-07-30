/**
 * CanvasLayer registration — 2D-overlay DOM component + native (WebGL) painter.
 *
 * `wrapsChildren: true` is load-bearing, not decorative: `CanvasLayerNative`
 * publishes a draw-order band and a fresh modulate scope that its descendants
 * must inherit, which only works if the walker renders them as its React
 * CHILDREN rather than its siblings. Without it the scope reaches nothing — a
 * HUD under `CanvasLayer(layer = 5)` paints in the world band, and
 * `visible = false` on the layer stops hiding its subtree.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { CanvasLayer } from './Component';
import { CanvasLayerNative } from './NativeComponent';

controlComponentRegistry.register({
  typeName: 'CanvasLayer',
  Component: CanvasLayer,
  Native: CanvasLayerNative,
  wrapsChildren: true,
});

export { CanvasLayer, CanvasLayerNative };
