/** Node2D registration — parser + formatter. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode2D } from './parser';
import { formatNode2DProperties } from './propertyFormatter';

const node2DRegistration: NodeTypeRegistration = {
  typeName: 'Node2D',
  parser: parseNode2D,
  propertyFormatter: formatNode2DProperties,
};

nodeRegistry.register(node2DRegistration);

export { node2DRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';
