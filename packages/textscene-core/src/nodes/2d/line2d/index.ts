/** Line2D registration — parser + formatter. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseLine2D } from './parser';
import { formatLine2DProperties } from './propertyFormatter';

const line2DRegistration: NodeTypeRegistration = {
  typeName: 'Line2D',
  parser: parseLine2D,
  propertyFormatter: formatLine2DProperties,
};

nodeRegistry.register(line2DRegistration);

export { line2DRegistration };
export type { Line2DProperties } from './types';
export * from './parser';
export * from './propertyFormatter';
