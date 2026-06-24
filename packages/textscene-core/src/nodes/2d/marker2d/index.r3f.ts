import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Marker2D } from './Component';

nodeComponentRegistry.register({ typeName: 'Marker2D', Component: Marker2D, canvasItem: true });

export { Marker2D };
