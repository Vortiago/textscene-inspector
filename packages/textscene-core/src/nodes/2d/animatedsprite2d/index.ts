/** AnimatedSprite2D registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseAnimatedSprite2D, isAnimatedSprite2D } from './parser';

const animatedSprite2DRegistration: NodeTypeRegistration = {
  typeName: 'AnimatedSprite2D',
  typeGuard: isAnimatedSprite2D,
  parser: parseAnimatedSprite2D,
};

nodeRegistry.register(animatedSprite2DRegistration);

export { animatedSprite2DRegistration };
export * from './parser';
export * from './types';
