/**
 * CanvasLayer registration: the native (WebGL canvas) painter. `wrapsChildren: true` renders
 * the descendants as React children, so they inherit the layer's draw-order band and modulate
 * scope. Without it a HUD under `CanvasLayer(layer = 5)` paints in the world band, and
 * `visible = false` does not hide the subtree.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { CanvasLayer } from './Component';

controlComponentRegistry.register({
  typeName: 'CanvasLayer',
  Component: CanvasLayer,
  wrapsChildren: true,
});
// Not a CanvasItem, and it authors no anchors or offsets. Without this the rect
// solve hands it (0, 0, 0, 0), and every Control under it anchors against that.
controlSolverRegistry.registerCanvasBoundary('CanvasLayer');

export { CanvasLayer };
