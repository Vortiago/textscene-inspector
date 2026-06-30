import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Line2D } from './Component';

nodeComponentRegistry.register({ typeName: 'Line2D', Component: Line2D, canvasItem: true });

export * from './Component';
