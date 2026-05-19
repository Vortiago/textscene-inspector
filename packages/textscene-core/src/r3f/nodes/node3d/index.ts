import { nodeComponentRegistry } from '../../NodeComponentRegistry';
import { Node3D } from './Component';

nodeComponentRegistry.register({ typeName: 'Node3D', Component: Node3D });

export { Node3D };
