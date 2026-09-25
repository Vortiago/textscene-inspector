/**
 * VisibleOnScreenNotifier2D draws nothing of its own (ADR-0008). It reuses the Node2D component
 * so its children still land in the right transform space.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node2D } from '../../base/node2d/Component';

nodeComponentRegistry.register({
  typeName: 'VisibleOnScreenNotifier2D',
  Component: Node2D,
  canvasItem: true,
  renderIntent: 'transform-only',
});
