/**
 * MultiMeshInstance2D registration: the parser. linterParser.ts holds the property validators.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseMultiMeshInstance2D } from './parser';

const multiMeshInstance2DRegistration: NodeTypeRegistration = {
  typeName: 'MultiMeshInstance2D',
  parser: parseMultiMeshInstance2D,
};

nodeRegistry.register(multiMeshInstance2DRegistration);

export * from './parser';
export * from './types';
