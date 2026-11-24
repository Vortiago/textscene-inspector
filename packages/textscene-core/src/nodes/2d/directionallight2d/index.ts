/** Registers the DirectionalLight2D parser and property formatter. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseDirectionalLight2D } from './parser';

const directionalLight2DRegistration: NodeTypeRegistration = {
  typeName: 'DirectionalLight2D',
  parser: parseDirectionalLight2D,
};

nodeRegistry.register(directionalLight2DRegistration);

export * from './parser';
export * from './types';
