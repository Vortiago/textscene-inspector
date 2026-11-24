/** Node2D registration: parser and formatter. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode2D } from './parser';

const node2DRegistration: NodeTypeRegistration = {
  typeName: 'Node2D',
  parser: parseNode2D,
};

nodeRegistry.register(node2DRegistration);

export * from './parser';
export * from './types';
