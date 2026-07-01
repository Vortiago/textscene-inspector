import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { AreaLight3D } from './Component';

nodeComponentRegistry.register({ typeName: 'AreaLight3D', Component: AreaLight3D });

export { AreaLight3D };
