/**
 * ParallaxBackground registration — render component.
 *
 * `canvasItem: true` even though a CanvasLayer is not a CanvasItem in Godot's
 * class hierarchy: the flag is the previewer's workspace classification (ADR-0006
 * amendment), and this node hosts world-canvas content, so the 2D stage must
 * draw it and the 3D viewport must not. It is also what makes a
 * ParallaxBackground-rooted scene (five of them in the corpus) open in 2D.
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

// The Control walk's half of the same fact: a `CanvasLayer` subclass is where
// `_enter_canvas`'s climb stops (`canvas_item.cpp:246-252`), so a Control below
// one parents at ITS canvas rather than hoisting to the viewport's.
controlComponentRegistry.register({
  typeName: 'ParallaxBackground',
  Component: ParallaxBackgroundCanvasScope,
  wrapsChildren: true,
});
controlSolverRegistry.registerCanvasBoundary('ParallaxBackground');

export { ParallaxBackground };
