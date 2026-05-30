/** CSGBox3D registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseCSGBox3D, isCSGBox3D } from './parser';

const csgBox3DRegistration: NodeTypeRegistration = {
  typeName: 'CSGBox3D',
  typeGuard: isCSGBox3D,
  parser: parseCSGBox3D,
};

nodeRegistry.register(csgBox3DRegistration);

export { csgBox3DRegistration };
export * from './parser';
export * from './types';
