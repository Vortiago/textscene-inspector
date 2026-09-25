/**
 * Registers the ParallaxBackground render component. `canvasItem: true` is the
 * workspace classification (ADR-0006 amendment), not Godot's hierarchy: the
 * node hosts world-canvas content, so it draws in the 2D stage and opens in 2D.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { controlComponentRegistry } from '../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../r3f/controls/native/solverRegistry';
import { ParallaxBackground } from './Component';
import { ParallaxBackgroundCanvasScope } from './CanvasScope';

nodeComponentRegistry.register({
  typeName: 'ParallaxBackground',
  Component: ParallaxBackground,
  canvasItem: true,
});

// `_enter_canvas`'s climb stops at a `CanvasLayer` subclass (`canvas_item.cpp:246-252`),
// so a Control below one parents at its canvas rather than the viewport's.
controlComponentRegistry.register({
  typeName: 'ParallaxBackground',
  Component: ParallaxBackgroundCanvasScope,
  wrapsChildren: true,
});
controlSolverRegistry.registerCanvasBoundary('ParallaxBackground');

export { ParallaxBackground };
