/** Sprite3D registration: the parser and the property formatter. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseSprite3D } from './parser';

const sprite3DRegistration: NodeTypeRegistration = {
  typeName: 'Sprite3D',
  parser: parseSprite3D,
};

nodeRegistry.register(sprite3DRegistration);

export * from './parser';
export * from './types';
