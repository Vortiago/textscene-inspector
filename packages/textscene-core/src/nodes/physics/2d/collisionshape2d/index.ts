/** CollisionShape2D registration: the parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseCollisionShape2D } from './parser';

const collisionShape2DRegistration: NodeTypeRegistration = {
  typeName: 'CollisionShape2D',
  parser: parseCollisionShape2D,
};

nodeRegistry.register(collisionShape2DRegistration);

export { collisionShape2DRegistration };
export * from './parser';
export * from './types';
