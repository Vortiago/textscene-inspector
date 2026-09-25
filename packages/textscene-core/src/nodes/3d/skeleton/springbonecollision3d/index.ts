/**
 * SpringBoneCollision3D registration: the parser. A non-visual node renders as a transform-only
 * group (ADR-0008), so both this parse and index.r3f.ts reuse Node3D's.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode3D } from '../../../base/node3d/parser';

const springBoneCollision3DRegistration: NodeTypeRegistration = {
  typeName: 'SpringBoneCollision3D',
  parser: parseNode3D,
};

nodeRegistry.register(springBoneCollision3DRegistration);

export { springBoneCollision3DRegistration };
