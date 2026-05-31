/** MarginContainer registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseMarginContainer, isMarginContainer } from './parser';

const marginContainerRegistration: NodeTypeRegistration = {
  typeName: 'MarginContainer',
  typeGuard: isMarginContainer,
  parser: parseMarginContainer,
};

nodeRegistry.register(marginContainerRegistration);

export { marginContainerRegistration };
export * from './parser';
