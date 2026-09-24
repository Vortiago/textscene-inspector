/**
 * SoftBody3D registration: the parser. It reuses MeshInstance3D's parse, not Node3D's, since
 * SoftBody3D derives from it and the inspector shows `mesh`, `skin` and the material overrides.
 * It is not drawn yet: `index.r3f.ts` registers the Node3D base under `renderIntent: 'pending'`,
 * so the badge reports the gap while `visible` and the 3D-workspace placement still behave.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseMeshInstance3D } from '../../../3d/meshinstance3d/parser';

const softBody3DRegistration: NodeTypeRegistration = {
  typeName: 'SoftBody3D',
  parser: parseMeshInstance3D,
};

nodeRegistry.register(softBody3DRegistration);

export { softBody3DRegistration };
