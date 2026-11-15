/** Registers the Parallax2D render component. */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Parallax2D } from './Component';

nodeComponentRegistry.register({
  typeName: 'Parallax2D',
  Component: Parallax2D,
  canvasItem: true,
});
