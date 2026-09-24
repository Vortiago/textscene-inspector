/**
 * Registers the Skeleton2D parser. It reuses the Node2D parse, and its property
 * knowledge lives in linterParser.ts.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode2D } from '../../base/node2d/parser';

const skeleton2DRegistration: NodeTypeRegistration = {
  typeName: 'Skeleton2D',
  parser: parseNode2D,
};

nodeRegistry.register(skeleton2DRegistration);

export { skeleton2DRegistration };
