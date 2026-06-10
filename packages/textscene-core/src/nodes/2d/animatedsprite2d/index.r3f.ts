import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { AnimatedSprite2D } from './Component';

nodeComponentRegistry.register({ typeName: 'AnimatedSprite2D', Component: AnimatedSprite2D });

export { AnimatedSprite2D };
