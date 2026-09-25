/** Registers the Path2D parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parsePath2D } from './parser';

const path2DRegistration: NodeTypeRegistration = {
  typeName: 'Path2D',
  parser: parsePath2D,
};

nodeRegistry.register(path2DRegistration);

export { path2DRegistration };
export * from './parser';
export * from './types';
