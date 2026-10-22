/**
 * CPUParticles3D draws no particles, so the badge reads "not implemented". Its component mounts the
 * GeometryInstance3D base for `visible`, the workspace split and the scene cull, and its selected
 * editor gizmos.
 */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { CPUParticles3D } from './Component';

nodeComponentRegistry.register({
  typeName: 'CPUParticles3D',
  Component: CPUParticles3D,
  renderIntent: 'pending',
});
