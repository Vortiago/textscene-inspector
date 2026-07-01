/**
 * AreaLight3D registration — parser + formatter.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseAreaLight3D } from './parser';
import { formatAreaLight3DProperties } from './propertyFormatter';

const areaLight3DRegistration: NodeTypeRegistration = {
  typeName: 'AreaLight3D',
  parser: parseAreaLight3D,
  propertyFormatter: formatAreaLight3DProperties,
};

nodeRegistry.register(areaLight3DRegistration);

export { areaLight3DRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';
