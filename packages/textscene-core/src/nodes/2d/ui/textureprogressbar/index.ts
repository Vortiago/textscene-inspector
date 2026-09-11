/** TextureProgressBar registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseTextureProgressBar } from './parser';

const textureProgressBarRegistration: NodeTypeRegistration = {
  typeName: 'TextureProgressBar',
  parser: parseTextureProgressBar,
};

nodeRegistry.register(textureProgressBarRegistration);

export { textureProgressBarRegistration };
export * from './parser';
export * from './types';
