/**
 * WorldEnvironment registration — parser + formatter.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseWorldEnvironment } from './parser';
import { formatWorldEnvironmentProperties } from './propertyFormatter';

const worldEnvironmentRegistration: NodeTypeRegistration = {
  typeName: 'WorldEnvironment',
  parser: parseWorldEnvironment,
  propertyFormatter: formatWorldEnvironmentProperties,
};

nodeRegistry.register(worldEnvironmentRegistration);

export { worldEnvironmentRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';
