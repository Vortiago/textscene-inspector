/**
 * PhysicalBoneSimulator3D drives the bones of its parent Skeleton3D from physics bodies. That
 * drive is a gap here (ADR-0045), so it registers `pending` on the Node3D component and its
 * children still land in the right transform space.
 */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';

nodeComponentRegistry.register({
  typeName: 'PhysicalBoneSimulator3D',
  Component: Node3D,
  renderIntent: 'pending',
});
