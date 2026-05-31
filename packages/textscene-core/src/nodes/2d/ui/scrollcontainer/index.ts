/** ScrollContainer registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseScrollContainer, isScrollContainer } from './parser';

const scrollContainerRegistration: NodeTypeRegistration = {
  typeName: 'ScrollContainer',
  typeGuard: isScrollContainer,
  parser: parseScrollContainer,
};

nodeRegistry.register(scrollContainerRegistration);

export { scrollContainerRegistration };
export * from './parser';
