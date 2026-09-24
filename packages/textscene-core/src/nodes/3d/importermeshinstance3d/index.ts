/**
 * ImporterMeshInstance3D parser registration. It reuses the Node3D parse, and
 * linterParser.ts holds its properties.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode3D } from '../../base/node3d/parser';

const importerMeshInstance3DRegistration: NodeTypeRegistration = {
  typeName: 'ImporterMeshInstance3D',
  parser: parseNode3D,
};

nodeRegistry.register(importerMeshInstance3DRegistration);

export { importerMeshInstance3DRegistration };
