/** AnimatedSprite2D registration: parser and formatter. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseAnimatedSprite2D } from './parser';
import { formatAnimatedSprite2DProperties } from './propertyFormatter';

const animatedSprite2DRegistration: NodeTypeRegistration = {
  typeName: 'AnimatedSprite2D',
  parser: parseAnimatedSprite2D,
  propertyFormatter: formatAnimatedSprite2DProperties,
};

nodeRegistry.register(animatedSprite2DRegistration);

export { animatedSprite2DRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';
