/**
 * Node (base type) registration: parser only. Used as the fallback for
 * any TSCN node type whose specific parser is not registered, so it has
 * no propertyFormatter section.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../core/NodeRegistry';
import { parseNode } from './parser';

const nodeRegistration: NodeTypeRegistration = {
  typeName: 'Node',
  parser: parseNode,
};

nodeRegistry.register(nodeRegistration);

export { nodeRegistration };
export * from './parser';
export * from './types';
