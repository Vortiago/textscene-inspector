import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { CSGBox3D } from './Component';

nodeComponentRegistry.register({ typeName: 'CSGBox3D', Component: CSGBox3D });

export { CSGBox3D };
