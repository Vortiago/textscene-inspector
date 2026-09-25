/** FlowContainer registration: the parser. `./index.r3f` registers the render side. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseFlowContainer } from './parser';

const flowContainerRegistration: NodeTypeRegistration = {
  typeName: 'FlowContainer',
  parser: parseFlowContainer,
};

nodeRegistry.register(flowContainerRegistration);

export { flowContainerRegistration };
export * from './parser';
export * from './types';
