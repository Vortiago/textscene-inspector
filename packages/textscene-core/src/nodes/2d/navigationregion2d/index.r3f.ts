import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { NavigationRegion2D } from './Component';

nodeComponentRegistry.register({
  typeName: 'NavigationRegion2D',
  Component: NavigationRegion2D,
  canvasItem: true,
});

export { NavigationRegion2D };
