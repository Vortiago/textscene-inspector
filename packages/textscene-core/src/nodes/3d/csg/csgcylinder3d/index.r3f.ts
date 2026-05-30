import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { CSGCylinder3D } from './Component';

nodeComponentRegistry.register({ typeName: 'CSGCylinder3D', Component: CSGCylinder3D });

export { CSGCylinder3D };
