/**
 * Label3D registration — parser + formatter.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseLabel3D } from './parser';
import { formatLabel3DProperties } from './propertyFormatter';

const label3DRegistration: NodeTypeRegistration = {
  typeName: 'Label3D',
  parser: parseLabel3D,
  propertyFormatter: formatLabel3DProperties,
};

nodeRegistry.register(label3DRegistration);

export { label3DRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';
