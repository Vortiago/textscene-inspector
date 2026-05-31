import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Sprite2D } from './Component';

nodeComponentRegistry.register({ typeName: 'Sprite2D', Component: Sprite2D });

export { Sprite2D };
