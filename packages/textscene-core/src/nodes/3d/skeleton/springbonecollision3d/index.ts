/**
 * SpringBoneCollision3D registration — parser.
 *
 * Non-visual node: renders as a transform-only group (ADR-0008), reusing the
 * Node3D transform parse; the render component (index.r3f.ts) reuses Node3D.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode3D } from '../../../base/node3d/parser';

const springBoneCollision3DRegistration: NodeTypeRegistration = {
  typeName: 'SpringBoneCollision3D',
  parser: parseNode3D,
};

nodeRegistry.register(springBoneCollision3DRegistration);

export { springBoneCollision3DRegistration };
