import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { CSGSphere3D } from './Component';

nodeComponentRegistry.register({ typeName: 'CSGSphere3D', Component: CSGSphere3D });

export { CSGSphere3D };
