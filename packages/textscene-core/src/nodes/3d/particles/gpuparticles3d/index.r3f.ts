/**
 * No particles are drawn, so the intent is `pending` and the badge reads
 * "not implemented". The Node3D base still mounts: it carries `visible` and
 * keeps the emitter's subtree in the 3D workspace, neither of which survives
 * falling through to `GenericNodeFallback`.
 */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';

nodeComponentRegistry.register({
  typeName: 'GPUParticles3D',
  Component: Node3D,
  renderIntent: 'pending',
});
