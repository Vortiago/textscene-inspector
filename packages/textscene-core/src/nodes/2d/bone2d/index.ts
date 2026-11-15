/**
 * Bone2D registration: the parser, the Node2D parse plus the rest pose.
 * linterParser.ts holds the property validators.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseBone2D } from './parser';

const bone2DRegistration: NodeTypeRegistration = {
  typeName: 'Bone2D',
  parser: parseBone2D,
};

nodeRegistry.register(bone2DRegistration);
