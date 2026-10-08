/**
 * MultiMeshInstance3D draws nothing, so the badge reads "not implemented". The
 * GeometryInstance3D base still mounts, for `visible`, the workspace split and the scene cull.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { undrawnGeometryInstance } from '../geometryinstance3d/Component';
import { useMultiMeshInstance3DAabb } from './ownAabb';

nodeComponentRegistry.register({
  typeName: 'MultiMeshInstance3D',
  Component: undrawnGeometryInstance(useMultiMeshInstance3DAabb),
  renderIntent: 'pending',
});
