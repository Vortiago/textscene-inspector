/**
 * CanvasLayer registration — native (WebGL canvas) painter.
 *
 * `wrapsChildren: true` is load-bearing, not decorative: `CanvasLayer`
 * publishes a draw-order band and a fresh modulate scope that its descendants
 * must inherit, which only works if the walker renders them as its React
 * CHILDREN rather than its siblings. Without it the scope reaches nothing — a
 * HUD under `CanvasLayer(layer = 5)` paints in the world band, and
 * `visible = false` on the layer stops hiding its subtree.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { CanvasLayer } from './Component';

controlComponentRegistry.register({
  typeName: 'CanvasLayer',
  Component: CanvasLayer,
  wrapsChildren: true,
});
// Not a CanvasItem, and it authors no anchors/offsets — without this the rect
// solve hands it (0, 0, 0, 0) and every Control in the HUD under it anchors
// against that instead of the layer's full rect (see `registerCanvasBoundary`).
controlSolverRegistry.registerCanvasBoundary('CanvasLayer');

export { CanvasLayer };
