/**
 * Skeleton3D poses its bones and deforms every mesh bound to it. The static pose is implemented
 * as a `scenePass` that gives each bound MeshInstance3D its skin matrices (`skeletonBindings.ts`),
 * so it registers `transform-only` on the Node3D component: it draws nothing of its own.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';
import { bindMeshesToSkeletons } from './skeletonBindings';

nodeComponentRegistry.register({
  typeName: 'Skeleton3D',
  Component: Node3D,
  renderIntent: 'transform-only',
  scenePass: { stage: 'paths', run: bindMeshesToSkeletons },
});
