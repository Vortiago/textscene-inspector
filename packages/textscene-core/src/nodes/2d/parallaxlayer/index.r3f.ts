/** ParallaxLayer registration — render component. */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { ParallaxLayer } from './Component';

nodeComponentRegistry.register({
  typeName: 'ParallaxLayer',
  Component: ParallaxLayer,
  canvasItem: true,
});

export { ParallaxLayer };
