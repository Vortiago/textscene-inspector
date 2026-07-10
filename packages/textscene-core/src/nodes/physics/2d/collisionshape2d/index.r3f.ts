/** CollisionShape2D registration — render component. `canvasItem: true`: Node2D-world content. */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { CollisionShape2D } from './Component';

nodeComponentRegistry.register({ typeName: 'CollisionShape2D', Component: CollisionShape2D, canvasItem: true });

export { CollisionShape2D };
