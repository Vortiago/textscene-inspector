/** HBoxContainer registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseHBoxContainer, isHBoxContainer } from './parser';

const hBoxContainerRegistration: NodeTypeRegistration = {
  typeName: 'HBoxContainer',
  typeGuard: isHBoxContainer,
  parser: parseHBoxContainer,
};

nodeRegistry.register(hBoxContainerRegistration);

export { hBoxContainerRegistration };
export * from './parser';
