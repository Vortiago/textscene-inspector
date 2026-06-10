/** MarginContainer registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseMarginContainer } from './parser';

const marginContainerRegistration: NodeTypeRegistration = {
  typeName: 'MarginContainer',
  parser: parseMarginContainer,
};

nodeRegistry.register(marginContainerRegistration);

export { marginContainerRegistration };
export * from './parser';
