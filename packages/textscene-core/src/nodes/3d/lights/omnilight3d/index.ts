/**
 * OmniLight3D registration — parser + formatter.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseOmniLight3D, isOmniLight3D } from './parser';
import { formatOmniLight3DProperties } from './propertyFormatter';

const omniLight3DRegistration: NodeTypeRegistration = {
  typeName: 'OmniLight3D',
  typeGuard: isOmniLight3D,
  parser: parseOmniLight3D,
  propertyFormatter: formatOmniLight3DProperties,
};

nodeRegistry.register(omniLight3DRegistration);

export { omniLight3DRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';
