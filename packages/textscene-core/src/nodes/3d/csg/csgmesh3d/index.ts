/**
 * CSGMesh3D registration — parser.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseCSGMesh3D } from './parser';

const cSGMesh3DRegistration: NodeTypeRegistration = {
  typeName: 'CSGMesh3D',
  parser: parseCSGMesh3D,
};

nodeRegistry.register(cSGMesh3DRegistration);

export { cSGMesh3DRegistration };
