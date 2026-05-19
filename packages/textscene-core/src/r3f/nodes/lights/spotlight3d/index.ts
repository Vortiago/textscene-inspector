import { nodeComponentRegistry } from '../../../NodeComponentRegistry';
import { SpotLight3D } from './Component';

nodeComponentRegistry.register({ typeName: 'SpotLight3D', Component: SpotLight3D });

export { SpotLight3D };
