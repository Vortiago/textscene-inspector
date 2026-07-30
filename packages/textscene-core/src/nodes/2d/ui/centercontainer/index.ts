/** CenterContainer registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseCenterContainer } from './parser';

const centerContainerRegistration: NodeTypeRegistration = {
  typeName: 'CenterContainer',
  parser: parseCenterContainer,
};

nodeRegistry.register(centerContainerRegistration);

export { centerContainerRegistration };
export * from './parser';
export * from './types';
