/**
 * Base Node registration - fallback for unsupported types and instance nodes.
 */

import { nodeRegistry } from '../../core/NodeRegistry';
import { isNode, parseNode } from './parser';
import { createNode } from './renderer';

nodeRegistry.register({
  typeName: 'Node',
  typeGuard: isNode,
  parser: parseNode,
  renderer: createNode,
});

export { parseNode, createNode, isNode };
export type { NodeProperties } from './types';
