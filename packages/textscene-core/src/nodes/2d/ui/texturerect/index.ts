/** TextureRect registration: the parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseTextureRect } from './parser';

const textureRectRegistration: NodeTypeRegistration = {
  typeName: 'TextureRect',
  parser: parseTextureRect,
};

nodeRegistry.register(textureRectRegistration);

export { textureRectRegistration };
export * from './parser';
export * from './types';
