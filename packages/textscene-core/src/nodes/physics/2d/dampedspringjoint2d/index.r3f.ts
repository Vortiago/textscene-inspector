/**
 * DampedSpringJoint2D draws nothing of its own (ADR-0008), so it reuses the Node2D
 * component, and its children still land in the right transform space.
 */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { Node2D } from '../../../base/node2d/Component';

nodeComponentRegistry.register({
  typeName: 'DampedSpringJoint2D',
  Component: Node2D,
  canvasItem: true,
  renderIntent: 'transform-only',
});
