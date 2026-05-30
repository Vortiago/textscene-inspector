/** VBoxContainer registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseVBoxContainer, isVBoxContainer } from './parser';

const vBoxContainerRegistration: NodeTypeRegistration = {
  typeName: 'VBoxContainer',
  typeGuard: isVBoxContainer,
  parser: parseVBoxContainer,
};

nodeRegistry.register(vBoxContainerRegistration);

export { vBoxContainerRegistration };
export * from './parser';
