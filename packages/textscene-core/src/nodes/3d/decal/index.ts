/**
 * Decal registration — parser + property formatter.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseDecal } from './parser';
import { formatDecalProperties } from './propertyFormatter';

const decalRegistration: NodeTypeRegistration = {
  typeName: 'Decal',
  parser: parseDecal,
  propertyFormatter: formatDecalProperties,
};

nodeRegistry.register(decalRegistration);

export { decalRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';
