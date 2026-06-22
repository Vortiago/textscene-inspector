import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Polygon2D } from './Component';

nodeComponentRegistry.register({ typeName: 'Polygon2D', Component: Polygon2D, canvasItem: true });

export { Polygon2D };
