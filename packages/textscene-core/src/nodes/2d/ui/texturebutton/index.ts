/** TextureButton registration: parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseTextureButton } from './parser';

const textureButtonRegistration: NodeTypeRegistration = {
  typeName: 'TextureButton',
  parser: parseTextureButton,
};

nodeRegistry.register(textureButtonRegistration);

export { textureButtonRegistration };
