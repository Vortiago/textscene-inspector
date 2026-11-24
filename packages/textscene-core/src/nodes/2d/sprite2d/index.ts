/** Registers the Sprite2D parser and property formatter. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseSprite2D } from './parser';

const sprite2DRegistration: NodeTypeRegistration = {
  typeName: 'Sprite2D',
  parser: parseSprite2D,
};

nodeRegistry.register(sprite2DRegistration);

export * from './parser';
export * from './types';
