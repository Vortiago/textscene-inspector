import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { CSGMesh3D } from './Component';

nodeComponentRegistry.register({ typeName: 'CSGMesh3D', Component: CSGMesh3D });

export { CSGMesh3D };
