/** GraphNode registration: parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseGraphNode } from './parser';

const graphNodeRegistration: NodeTypeRegistration = {
  typeName: 'GraphNode',
  parser: parseGraphNode,
};

nodeRegistry.register(graphNodeRegistration);

export { graphNodeRegistration };
export * from './parser';
export * from './types';
