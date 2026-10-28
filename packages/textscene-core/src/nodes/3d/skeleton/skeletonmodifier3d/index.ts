/** SkeletonModifier3D registration: the parser, which reads `active` and `influence`. index.r3f.ts holds its effect on the pose. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseSkeletonModifier3D } from './parser';

const registration: NodeTypeRegistration = {
  typeName: 'SkeletonModifier3D',
  parser: parseSkeletonModifier3D,
};

nodeRegistry.register(registration);
