/**
 * WorldEnvironment registration: the parser and the property formatter.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseWorldEnvironment } from './parser';

const worldEnvironmentRegistration: NodeTypeRegistration = {
  typeName: 'WorldEnvironment',
  parser: parseWorldEnvironment,
};

nodeRegistry.register(worldEnvironmentRegistration);

export * from './parser';
export * from './types';
