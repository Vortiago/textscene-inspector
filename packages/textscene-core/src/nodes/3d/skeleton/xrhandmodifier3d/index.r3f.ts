/**
 * XRHandModifier3D writes tracked hand poses into the bones of its parent Skeleton3D, through a
 * live XR session. That drive is a gap here (ADR-0045), so it registers `pending` on the Node3D
 * component and its children still land in the right transform space.
 */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';

nodeComponentRegistry.register({
  typeName: 'XRHandModifier3D',
  Component: Node3D,
  renderIntent: 'pending',
});
