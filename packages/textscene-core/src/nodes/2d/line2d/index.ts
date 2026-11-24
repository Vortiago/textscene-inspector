/** Line2D registration: parser and formatter. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseLine2D } from './parser';

const line2DRegistration: NodeTypeRegistration = {
  typeName: 'Line2D',
  parser: parseLine2D,
};

nodeRegistry.register(line2DRegistration);

export * from './parser';
