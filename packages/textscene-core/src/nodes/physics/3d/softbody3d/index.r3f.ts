/**
 * SoftBody3D draws nothing here yet, and the badge reads "not implemented". The
 * GeometryInstance3D base still mounts, for `visible`, the workspace split and the scene cull.
 */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { GeometryInstance3D } from '../../../3d/geometryinstance3d/Component';

nodeComponentRegistry.register({
  typeName: 'SoftBody3D',
  Component: GeometryInstance3D,
  renderIntent: 'pending',
});
