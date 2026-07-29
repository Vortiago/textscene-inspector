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
import { ParallaxBackground } from './Component';

nodeComponentRegistry.register({
  typeName: 'ParallaxBackground',
  Component: ParallaxBackground,
  canvasItem: true,
});

export { ParallaxBackground };
