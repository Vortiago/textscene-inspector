/** VSplitContainer registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseVSplitContainer } from './parser';

const vSplitContainerRegistration: NodeTypeRegistration = {
  typeName: 'VSplitContainer',
  parser: parseVSplitContainer,
};

nodeRegistry.register(vSplitContainerRegistration);

export { vSplitContainerRegistration };
export * from './parser';
export * from './types';
