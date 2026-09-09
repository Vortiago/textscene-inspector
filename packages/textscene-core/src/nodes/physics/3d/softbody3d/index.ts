/**
 * SoftBody3D registration: parser.
 *
 * Reuses MeshInstance3D's parse, not Node3D's: SoftBody3D derives from it and
 * inherits its whole validator set, so parsing through Node3D validated `mesh`,
 * `skin` and the material overrides and then discarded them, leaving the
 * inspector blank for the properties the sheet advertises.
 * Not drawn yet: `index.r3f.ts` registers the Node3D base under
 * `renderIntent: 'pending'`, so the badge reports the gap while `visible` and
 * the 3D-workspace placement still behave.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseMeshInstance3D } from '../../../3d/meshinstance3d/parser';

const softBody3DRegistration: NodeTypeRegistration = {
  typeName: 'SoftBody3D',
  parser: parseMeshInstance3D,
};

nodeRegistry.register(softBody3DRegistration);

export { softBody3DRegistration };
