import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Sprite3D } from './Component';

nodeComponentRegistry.register({ typeName: 'Sprite3D', Component: Sprite3D });

export { Sprite3D };
