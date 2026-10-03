/**
 * Skeleton2D runs its modification stack on its bones every frame. That drive is a
 * gap here (ADR-0045), so it registers `pending` on the Node2D component and its
 * children still land in the right transform space.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node2D } from '../../base/node2d/Component';

nodeComponentRegistry.register({
  typeName: 'Skeleton2D',
  Component: Node2D,
  canvasItem: true,
  renderIntent: 'pending',
});
