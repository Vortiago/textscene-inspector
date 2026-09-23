/**
 * VFlowContainer registration: FlowContainer's parser, since the two read every key the same way.
 * Render wiring lives in `./index.r3f`.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseFlowContainer } from '../flowcontainer/parser';

const vFlowContainerRegistration: NodeTypeRegistration = {
  typeName: 'VFlowContainer',
  parser: parseFlowContainer,
};

nodeRegistry.register(vFlowContainerRegistration);

export { vFlowContainerRegistration };
