/** Sprite3D registration: the parser and the property formatter. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseSprite3D } from './parser';
import { formatSprite3DProperties } from './propertyFormatter';

const sprite3DRegistration: NodeTypeRegistration = {
  typeName: 'Sprite3D',
  parser: parseSprite3D,
  propertyFormatter: formatSprite3DProperties,
};

nodeRegistry.register(sprite3DRegistration);

export { sprite3DRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';
