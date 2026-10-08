/**
 * No particles are drawn, so the intent is `pending` and the badge reads
 * "not implemented". The GeometryInstance3D base still mounts: it carries
 * `visible`, keeps the emitter's subtree in the 3D workspace and holds its place in the scene cull,
 * none of which survives falling through to `GenericNodeFallback`.
 */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { GeometryInstance3D } from '../../geometryinstance3d/Component';

nodeComponentRegistry.register({
  typeName: 'GPUParticles3D',
  Component: GeometryInstance3D,
  renderIntent: 'pending',
});
