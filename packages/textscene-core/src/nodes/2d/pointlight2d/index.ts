/** Registers the PointLight2D parser and property formatter. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parsePointLight2D } from './parser';

const pointLight2DRegistration: NodeTypeRegistration = {
  typeName: 'PointLight2D',
  parser: parsePointLight2D,
};

nodeRegistry.register(pointLight2DRegistration);

export * from './parser';
export * from './types';
