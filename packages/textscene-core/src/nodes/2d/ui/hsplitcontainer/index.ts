/** HSplitContainer registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseHSplitContainer } from './parser';

const hSplitContainerRegistration: NodeTypeRegistration = {
  typeName: 'HSplitContainer',
  parser: parseHSplitContainer,
};

nodeRegistry.register(hSplitContainerRegistration);

export { hSplitContainerRegistration };
export * from './parser';
export * from './types';
