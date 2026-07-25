/**
 * CSGPolygon3D registration — parser.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseCSGPolygon3D } from './parser';

const cSGPolygon3DRegistration: NodeTypeRegistration = {
  typeName: 'CSGPolygon3D',
  parser: parseCSGPolygon3D,
};

nodeRegistry.register(cSGPolygon3DRegistration);

export { cSGPolygon3DRegistration };
export * from './parser';
export * from './types';
