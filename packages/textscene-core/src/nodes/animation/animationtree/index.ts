/**
 * AnimationTree registration — parser + property formatter.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { isAnimationTree, parseAnimationTree } from './parser';
import { formatAnimationTreeProperties } from './propertyFormatter';

const animationTreeRegistration: NodeTypeRegistration = {
  typeName: 'AnimationTree',
  typeGuard: isAnimationTree,
  parser: parseAnimationTree,
  propertyFormatter: formatAnimationTreeProperties,
};

nodeRegistry.register(animationTreeRegistration);

export { animationTreeRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';
