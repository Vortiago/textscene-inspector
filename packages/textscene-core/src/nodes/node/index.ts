/**
 * Node (base type) registration — parser only. Used as the fallback for
 * any TSCN node type whose specific parser isn't registered, so it has
 * no propertyFormatter section.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../core/NodeRegistry';
import { parseNode, isNode } from './parser';

const nodeRegistration: NodeTypeRegistration = {
  typeName: 'Node',
  typeGuard: isNode,
  parser: parseNode,
};

nodeRegistry.register(nodeRegistration);

export { nodeRegistration };
export * from './parser';
export * from './types';
