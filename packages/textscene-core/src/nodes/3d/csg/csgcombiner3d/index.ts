/**
 * CSGCombiner3D registration — parser.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseCSGCombiner3D } from './parser';

const cSGCombiner3DRegistration: NodeTypeRegistration = {
  typeName: 'CSGCombiner3D',
  parser: parseCSGCombiner3D,
};

nodeRegistry.register(cSGCombiner3DRegistration);

export { cSGCombiner3DRegistration };
