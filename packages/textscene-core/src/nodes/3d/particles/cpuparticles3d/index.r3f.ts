/**
 * CPUParticles3D draws nothing, so the badge reads "not implemented". The
 * GeometryInstance3D base still mounts, for `visible`, the workspace split and the scene cull.
 */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { undrawnGeometryInstance } from '../../geometryinstance3d/Component';
import { useCPUParticles3DAabb } from './ownAabb';

nodeComponentRegistry.register({
  typeName: 'CPUParticles3D',
  Component: undrawnGeometryInstance(useCPUParticles3DAabb),
  renderIntent: 'pending',
});
