/**
 * Node3D registration: parser and formatter.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode3D } from './parser';

const node3DRegistration: NodeTypeRegistration = {
  typeName: 'Node3D',
  parser: parseNode3D,
};

nodeRegistry.register(node3DRegistration);

export * from './parser';
export * from './types';
