/** GridContainer registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseGridContainer, isGridContainer } from './parser';

const gridContainerRegistration: NodeTypeRegistration = {
  typeName: 'GridContainer',
  typeGuard: isGridContainer,
  parser: parseGridContainer,
};

nodeRegistry.register(gridContainerRegistration);

export { gridContainerRegistration };
export * from './parser';
export * from './types';
