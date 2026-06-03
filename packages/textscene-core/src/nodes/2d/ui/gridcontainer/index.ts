/** GridContainer registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseGridContainer } from './parser';

const gridContainerRegistration: NodeTypeRegistration = {
  typeName: 'GridContainer',
  parser: parseGridContainer,
};

nodeRegistry.register(gridContainerRegistration);

export { gridContainerRegistration };
export * from './parser';
export * from './types';
