import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { LightOccluder2D } from './Component';

nodeComponentRegistry.register({
  typeName: 'LightOccluder2D',
  Component: LightOccluder2D,
  canvasItem: true,
});

export { LightOccluder2D };
