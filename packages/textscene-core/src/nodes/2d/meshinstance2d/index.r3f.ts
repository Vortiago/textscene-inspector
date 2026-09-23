/**
 * MeshInstance2D draws nothing yet, and the badge reads "not implemented". The Node2D
 * base still mounts, for `visible` and the workspace split.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node2D } from '../../base/node2d/Component';

nodeComponentRegistry.register({
  typeName: 'MeshInstance2D',
  Component: Node2D,
  canvasItem: true,
  renderIntent: 'pending',
});
