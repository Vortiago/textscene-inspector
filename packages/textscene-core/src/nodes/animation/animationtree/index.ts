/**
 * AnimationTree registration: parser and property formatter.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseAnimationTree } from './parser';

const animationTreeRegistration: NodeTypeRegistration = {
  typeName: 'AnimationTree',
  parser: parseAnimationTree,
};

nodeRegistry.register(animationTreeRegistration);

export * from './parser';
export * from './types';
