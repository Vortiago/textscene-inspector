/**
 * AnimationPlayer registration — parser + property formatter.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseAnimationPlayer } from './parser';
import { formatAnimationPlayerProperties } from './propertyFormatter';

const animationPlayerRegistration: NodeTypeRegistration = {
  typeName: 'AnimationPlayer',
  parser: parseAnimationPlayer,
  propertyFormatter: formatAnimationPlayerProperties,
};

nodeRegistry.register(animationPlayerRegistration);

export { animationPlayerRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';
