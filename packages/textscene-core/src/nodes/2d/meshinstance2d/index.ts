/**
 * MeshInstance2D registration: the parser, which reuses the Node2D parse.
 * linterParser.ts holds the property validators.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode2D } from '../../base/node2d/parser';

const meshInstance2DRegistration: NodeTypeRegistration = {
  typeName: 'MeshInstance2D',
  parser: parseNode2D,
};

nodeRegistry.register(meshInstance2DRegistration);

export { meshInstance2DRegistration };
