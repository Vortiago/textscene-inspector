/**
 * SkeletonModifier3D is the base of every node that rewrites a Skeleton3D's bone poses. That
 * pipeline is a gap here (ADR-0045), so it registers `pending` on the Node3D component and its
 * children still land in the right transform space.
 */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';

nodeComponentRegistry.register({
  typeName: 'SkeletonModifier3D',
  Component: Node3D,
  renderIntent: 'pending',
});
