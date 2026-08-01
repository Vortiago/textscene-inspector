/**
 * SoftBody3D registration: parser.
 *
 * Reuses MeshInstance3D's parse, not Node3D's: SoftBody3D derives from it and
 * inherits its whole validator set, so parsing through Node3D validated `mesh`,
 * `skin` and the material overrides and then discarded them, leaving the
 * inspector blank for the properties the sheet advertises.
 * Not rendered yet, so it registers NO component: the dispatcher falls back to
 * GenericNodeFallback and the tree keeps reporting it as not implemented.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseMeshInstance3D } from '../../../3d/meshinstance3d/parser';

const softBody3DRegistration: NodeTypeRegistration = {
  typeName: 'SoftBody3D',
  parser: parseMeshInstance3D,
};

nodeRegistry.register(softBody3DRegistration);

export { softBody3DRegistration };
