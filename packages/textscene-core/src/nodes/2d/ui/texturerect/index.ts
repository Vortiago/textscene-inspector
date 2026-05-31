/** TextureRect registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseTextureRect, isTextureRect } from './parser';

const textureRectRegistration: NodeTypeRegistration = {
  typeName: 'TextureRect',
  typeGuard: isTextureRect,
  parser: parseTextureRect,
};

nodeRegistry.register(textureRectRegistration);

export { textureRectRegistration };
export * from './parser';
export * from './types';
