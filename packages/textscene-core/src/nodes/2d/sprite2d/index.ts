/** Sprite2D registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseSprite2D, isSprite2D } from './parser';

const sprite2DRegistration: NodeTypeRegistration = {
  typeName: 'Sprite2D',
  typeGuard: isSprite2D,
  parser: parseSprite2D,
};

nodeRegistry.register(sprite2DRegistration);

export { sprite2DRegistration };
export * from './parser';
export * from './types';
