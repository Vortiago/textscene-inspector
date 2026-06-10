import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { MeshInstance3D } from './Component';

nodeComponentRegistry.register({ typeName: 'MeshInstance3D', Component: MeshInstance3D });

export { MeshInstance3D };
