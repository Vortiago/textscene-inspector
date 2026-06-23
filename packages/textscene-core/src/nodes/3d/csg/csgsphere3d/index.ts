/** CSGSphere3D registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseCSGSphere3D } from './parser';

const csgSphere3DRegistration: NodeTypeRegistration = {
  typeName: 'CSGSphere3D',
  parser: parseCSGSphere3D,
};

nodeRegistry.register(csgSphere3DRegistration);

export { csgSphere3DRegistration };
export * from './parser';
export * from './types';
