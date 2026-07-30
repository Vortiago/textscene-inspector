/** SubViewportContainer registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseSubViewportContainer } from './parser';

const subViewportContainerRegistration: NodeTypeRegistration = {
  typeName: 'SubViewportContainer',
  parser: parseSubViewportContainer,
};

nodeRegistry.register(subViewportContainerRegistration);

export { subViewportContainerRegistration };
export * from './parser';
