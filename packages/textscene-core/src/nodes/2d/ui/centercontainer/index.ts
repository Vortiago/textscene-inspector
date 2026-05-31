/** CenterContainer registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseCenterContainer, isCenterContainer } from './parser';

const centerContainerRegistration: NodeTypeRegistration = {
  typeName: 'CenterContainer',
  typeGuard: isCenterContainer,
  parser: parseCenterContainer,
};

nodeRegistry.register(centerContainerRegistration);

export { centerContainerRegistration };
export * from './parser';
