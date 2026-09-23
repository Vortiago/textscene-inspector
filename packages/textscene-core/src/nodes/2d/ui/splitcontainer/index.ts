/** SplitContainer registration: parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseSplitContainer } from './parser';

const splitContainerRegistration: NodeTypeRegistration = {
  typeName: 'SplitContainer',
  parser: parseSplitContainer,
};

nodeRegistry.register(splitContainerRegistration);

export { splitContainerRegistration };
export * from './parser';
export * from './types';
