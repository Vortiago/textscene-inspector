/**
 * Remaining 2D physics bodies — render registration. All reuse the Node2D
 * transform-group Component (see ./index.ts for the rationale): they
 * position their children via the 2D transform and draw no geometry of their
 * own. Area2D and CollisionShape2D moved to their own slices — see ./index.ts.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node2D } from '../../base/node2d/Component';
import { TWO_D_PHYSICS_TYPES } from './index';

for (const typeName of TWO_D_PHYSICS_TYPES) {
  nodeComponentRegistry.register({ typeName, Component: Node2D, canvasItem: true });
}
