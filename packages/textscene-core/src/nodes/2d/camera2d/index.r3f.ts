import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Camera2D } from './Component';

nodeComponentRegistry.register({ typeName: 'Camera2D', Component: Camera2D });

export { Camera2D };
