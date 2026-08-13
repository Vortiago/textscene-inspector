/**
 * OpenXRCompositionLayerQuad draws nothing here YET — the badge reads "not implemented". The
 * Node3D base still mounts, for `visible` and the workspace split.
 */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';

nodeComponentRegistry.register({
  typeName: 'OpenXRCompositionLayerQuad',
  Component: Node3D,
  renderIntent: 'pending',
});
