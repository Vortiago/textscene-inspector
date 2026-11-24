/**
 * Decal registration: the parser and property formatter.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseDecal } from './parser';

const decalRegistration: NodeTypeRegistration = {
  typeName: 'Decal',
  parser: parseDecal,
};

nodeRegistry.register(decalRegistration);

export * from './parser';
export * from './types';
