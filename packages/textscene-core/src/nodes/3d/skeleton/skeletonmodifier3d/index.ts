/**
 * SkeletonModifier3D registration: the parser. Its Godot effect is not implemented here yet
 * (ADR-0045), so both this parse and index.r3f.ts reuse Node3D's, the registration `pending`.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode3D } from '../../../base/node3d/parser';

const skeletonModifier3DRegistration: NodeTypeRegistration = {
  typeName: 'SkeletonModifier3D',
  parser: parseNode3D,
};

nodeRegistry.register(skeletonModifier3DRegistration);

export { skeletonModifier3DRegistration };
