import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node2D } from './Component';

nodeComponentRegistry.register({ typeName: 'Node2D', Component: Node2D });

export { Node2D };
