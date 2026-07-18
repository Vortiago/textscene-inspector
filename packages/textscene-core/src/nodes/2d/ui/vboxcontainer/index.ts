/** VBoxContainer registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseVBoxContainer } from './parser';

const vBoxContainerRegistration: NodeTypeRegistration = {
  typeName: 'VBoxContainer',
  parser: parseVBoxContainer,
};

nodeRegistry.register(vBoxContainerRegistration);

export { vBoxContainerRegistration };
export * from './parser';
export * from './types';
