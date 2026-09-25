/**
 * Bone2D registration: the parser, which reuses the Node2D parse.
 * linterParser.ts holds the property validators.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode2D } from '../../base/node2d/parser';

const bone2DRegistration: NodeTypeRegistration = {
  typeName: 'Bone2D',
  parser: parseNode2D,
};

nodeRegistry.register(bone2DRegistration);

export { bone2DRegistration };
