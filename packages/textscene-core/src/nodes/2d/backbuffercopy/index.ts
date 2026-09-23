/**
 * BackBufferCopy registration: the parser, which reuses the Node2D parse.
 * linterParser.ts holds the property validators.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode2D } from '../../base/node2d/parser';

const backBufferCopyRegistration: NodeTypeRegistration = {
  typeName: 'BackBufferCopy',
  parser: parseNode2D,
};

nodeRegistry.register(backBufferCopyRegistration);

export { backBufferCopyRegistration };
