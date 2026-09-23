/**
 * StaticBody2D, RigidBody2D and CharacterBody2D render registration. They reuse the Node2D
 * transform-group Component (see ./index.ts): they position their children through the 2D
 * transform and draw no geometry of their own.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node2D } from '../../base/node2d/Component';
import { TWO_D_PHYSICS_TYPES } from './index';

for (const typeName of TWO_D_PHYSICS_TYPES) {
  nodeComponentRegistry.register({
    typeName,
    Component: Node2D,
    canvasItem: true,
    renderIntent: 'transform-only',
  });
}
