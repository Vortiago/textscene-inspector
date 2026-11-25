import { nodeRegistry, type NodeTypeRegistration } from '../../core/NodeRegistry';
import { parseNode } from './parser';

const nodeRegistration: NodeTypeRegistration = {
  typeName: 'Node',
  parser: parseNode,
};

nodeRegistry.register(nodeRegistration);

export * from './parser';
export * from './types';
