import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { CollisionShape3D } from './Component';

nodeComponentRegistry.register({ typeName: 'CollisionShape3D', Component: CollisionShape3D });

export { CollisionShape3D };
