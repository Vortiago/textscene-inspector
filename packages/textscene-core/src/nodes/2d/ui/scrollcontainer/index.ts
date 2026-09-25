/** Registers the ScrollContainer parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseScrollContainer } from './parser';

const scrollContainerRegistration: NodeTypeRegistration = {
  typeName: 'ScrollContainer',
  parser: parseScrollContainer,
};

nodeRegistry.register(scrollContainerRegistration);

export { scrollContainerRegistration };
export * from './parser';
