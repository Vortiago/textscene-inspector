/**
 * HFlowContainer registration: parser. Reuses FlowContainer's parser
 * directly: the only difference between the two is which keys `vertical`
 * appears under in the file, not how any key is read. Render side: `./index.r3f`.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseFlowContainer } from '../flowcontainer/parser';

const hFlowContainerRegistration: NodeTypeRegistration = {
  typeName: 'HFlowContainer',
  parser: parseFlowContainer,
};

nodeRegistry.register(hFlowContainerRegistration);

export { hFlowContainerRegistration };
