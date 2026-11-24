/**
 * AnimationPlayer registration: parser and property formatter.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseAnimationPlayer } from './parser';

const animationPlayerRegistration: NodeTypeRegistration = {
  typeName: 'AnimationPlayer',
  parser: parseAnimationPlayer,
};

nodeRegistry.register(animationPlayerRegistration);

export * from './parser';
export * from './types';
