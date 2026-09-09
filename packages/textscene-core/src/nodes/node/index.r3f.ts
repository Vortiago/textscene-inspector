import { nodeComponentRegistry } from '../../r3f/NodeComponentRegistry';
import { Node } from './Component';

nodeComponentRegistry.register({ typeName: 'Node', Component: Node, container: true, renderIntent: 'transform-only' });

export { Node };
