/** CSGCylinder3D registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseCSGCylinder3D, isCSGCylinder3D } from './parser';

const csgCylinder3DRegistration: NodeTypeRegistration = {
  typeName: 'CSGCylinder3D',
  typeGuard: isCSGCylinder3D,
  parser: parseCSGCylinder3D,
};

nodeRegistry.register(csgCylinder3DRegistration);

export { csgCylinder3DRegistration };
export * from './parser';
export * from './types';
