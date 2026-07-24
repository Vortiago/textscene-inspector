import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { PointLight2D } from './Component';

nodeComponentRegistry.register({ typeName: 'PointLight2D', Component: PointLight2D, canvasItem: true });

export { PointLight2D };
