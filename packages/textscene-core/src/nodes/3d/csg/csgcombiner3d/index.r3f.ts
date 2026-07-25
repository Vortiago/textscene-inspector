import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { CSGCombiner3D } from './Component';

nodeComponentRegistry.register({ typeName: 'CSGCombiner3D', Component: CSGCombiner3D });

export { CSGCombiner3D };
