/**
 * Registers the Skeleton2D parser: the Node2D parse and the modification stack reference.
 * linterParser.ts holds the property validators.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseSkeleton2D } from './parser';

const skeleton2DRegistration: NodeTypeRegistration = {
  typeName: 'Skeleton2D',
  parser: parseSkeleton2D,
};

nodeRegistry.register(skeleton2DRegistration);
