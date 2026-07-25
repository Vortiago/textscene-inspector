import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { CSGTorus3D } from './Component';

nodeComponentRegistry.register({ typeName: 'CSGTorus3D', Component: CSGTorus3D });

export { CSGTorus3D };
