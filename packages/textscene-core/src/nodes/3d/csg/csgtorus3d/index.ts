/**
 * CSGTorus3D registration — parser.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseCSGTorus3D } from './parser';

const cSGTorus3DRegistration: NodeTypeRegistration = {
  typeName: 'CSGTorus3D',
  parser: parseCSGTorus3D,
};

nodeRegistry.register(cSGTorus3DRegistration);

export { cSGTorus3DRegistration };
