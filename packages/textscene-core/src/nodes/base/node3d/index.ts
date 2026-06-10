/**
 * Node3D registration — parser + formatter.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode3D } from './parser';
import { formatNode3DProperties } from './propertyFormatter';

const node3DRegistration: NodeTypeRegistration = {
  typeName: 'Node3D',
  parser: parseNode3D,
  propertyFormatter: formatNode3DProperties,
};

nodeRegistry.register(node3DRegistration);

export { node3DRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';
