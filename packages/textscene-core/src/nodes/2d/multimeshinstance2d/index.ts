/**
 * MultiMeshInstance2D registration: the parser, which reuses the Node2D parse.
 * linterParser.ts holds the property validators.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode2D } from '../../base/node2d/parser';

const multiMeshInstance2DRegistration: NodeTypeRegistration = {
  typeName: 'MultiMeshInstance2D',
  parser: parseNode2D,
};

nodeRegistry.register(multiMeshInstance2DRegistration);

export { multiMeshInstance2DRegistration };
