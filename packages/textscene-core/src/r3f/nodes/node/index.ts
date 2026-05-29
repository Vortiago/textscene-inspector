import { nodeComponentRegistry } from '../../NodeComponentRegistry';
import { Node } from './Component';

nodeComponentRegistry.register({ typeName: 'Node', Component: Node });

export { Node };
