/**
 * Registers the Skeleton2D parser. It reuses the Node2D parse, and its property
 * knowledge lives in linterParser.ts. Its Godot effect is not implemented here yet
 * (ADR-0045), so index.r3f.ts registers Node2D as `pending`.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode2D } from '../../base/node2d/parser';

const skeleton2DRegistration: NodeTypeRegistration = {
  typeName: 'Skeleton2D',
  parser: parseNode2D,
};

nodeRegistry.register(skeleton2DRegistration);

export { skeleton2DRegistration };
