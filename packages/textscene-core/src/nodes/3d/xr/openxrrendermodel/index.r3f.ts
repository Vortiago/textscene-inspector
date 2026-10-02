/**
 * OpenXRRenderModel mounts the tracked controller's model scene as its child, through a live XR
 * session. That draw is a gap here (ADR-0045), so it registers `pending` on the Node3D component
 * and its children still land in the right transform space.
 */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';

nodeComponentRegistry.register({
  typeName: 'OpenXRRenderModel',
  Component: Node3D,
  renderIntent: 'pending',
});
