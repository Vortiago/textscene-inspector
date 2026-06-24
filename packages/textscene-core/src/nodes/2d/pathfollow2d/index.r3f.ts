import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { PathFollow2D } from './Component';

nodeComponentRegistry.register({ typeName: 'PathFollow2D', Component: PathFollow2D, canvasItem: true });

export { PathFollow2D };
