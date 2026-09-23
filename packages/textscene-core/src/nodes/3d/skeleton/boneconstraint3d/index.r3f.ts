/**
 * BoneConstraint3D draws nothing of its own (ADR-0008), so it reuses the Node3D component and its
 * children still land in the right transform space.
 */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';

nodeComponentRegistry.register({
  typeName: 'BoneConstraint3D',
  Component: Node3D,
  renderIntent: 'transform-only',
});
