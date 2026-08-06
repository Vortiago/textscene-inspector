/**
 * FogVolume registration — parser.
 *
 * Reuses the Node3D parse; property knowledge lives in linterParser.ts.
 * Not rendered yet, so it registers NO component: the dispatcher falls back to
 * GenericNodeFallback and the tree keeps reporting it as not implemented.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode3D } from '../../base/node3d/parser';

const fogVolumeRegistration: NodeTypeRegistration = {
  typeName: 'FogVolume',
  parser: parseNode3D,
};

nodeRegistry.register(fogVolumeRegistration);

export { fogVolumeRegistration };
