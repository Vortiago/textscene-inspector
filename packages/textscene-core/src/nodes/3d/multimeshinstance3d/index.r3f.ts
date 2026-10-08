/**
 * MultiMeshInstance3D draws nothing, so the badge reads "not implemented". The
 * GeometryInstance3D base still mounts, for `visible`, the workspace split and the scene cull.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { GeometryInstance3D } from '../geometryinstance3d/Component';

nodeComponentRegistry.register({
  typeName: 'MultiMeshInstance3D',
  Component: GeometryInstance3D,
  renderIntent: 'pending',
});
