/** CollisionShape3D registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseCollisionShape3D, isCollisionShape3D } from './parser';

const collisionShape3DRegistration: NodeTypeRegistration = {
  typeName: 'CollisionShape3D',
  typeGuard: isCollisionShape3D,
  parser: parseCollisionShape3D,
};

nodeRegistry.register(collisionShape3DRegistration);

export { collisionShape3DRegistration };
export * from './parser';
export * from './types';
