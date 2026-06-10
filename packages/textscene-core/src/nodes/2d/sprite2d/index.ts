/** Sprite2D registration — parser + formatter. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseSprite2D } from './parser';
import { formatSprite2DProperties } from './propertyFormatter';

const sprite2DRegistration: NodeTypeRegistration = {
  typeName: 'Sprite2D',
  parser: parseSprite2D,
  propertyFormatter: formatSprite2DProperties,
};

nodeRegistry.register(sprite2DRegistration);

export { sprite2DRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';
