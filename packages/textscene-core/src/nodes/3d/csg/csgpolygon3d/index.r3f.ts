import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { CSGPolygon3D } from './Component';

nodeComponentRegistry.register({ typeName: 'CSGPolygon3D', Component: CSGPolygon3D });

export { CSGPolygon3D };
