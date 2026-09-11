/** FlowContainer registration — parser. Render side: `./index.r3f`. */

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
