import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { SpotLight3D } from './Component';

nodeComponentRegistry.register({ typeName: 'SpotLight3D', Component: SpotLight3D });

export { SpotLight3D };
