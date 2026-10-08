import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { DirectionalLight2D } from './Component';

nodeComponentRegistry.register({
  typeName: 'DirectionalLight2D',
  Component: DirectionalLight2D,
  canvasItem: true,
});

export { DirectionalLight2D };
