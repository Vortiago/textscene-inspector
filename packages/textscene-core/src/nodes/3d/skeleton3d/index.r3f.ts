/**
 * Skeleton3D poses its bones and deforms every mesh bound to it. The static pose is implemented
 * as a live `scenePass`, `bindMeshesToSkeletons` (`skeletonBindings.ts`), which each MeshInstance3D
 * reads by its live path, so it registers `transform-only` on the Node3D component: it draws
 * nothing of its own.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';

nodeComponentRegistry.register({
  typeName: 'Skeleton3D',
  Component: Node3D,
  renderIntent: 'transform-only',
  scenePass: { stage: 'live' },
});
