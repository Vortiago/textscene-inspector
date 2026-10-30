/** XRHandModifier3D registration: the parser, which reads `active` and `influence`. index.r3f.ts holds its effect on the pose. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseSkeletonModifier3D } from '../skeletonmodifier3d/parser';

const registration: NodeTypeRegistration = {
  typeName: 'XRHandModifier3D',
  parser: parseSkeletonModifier3D,
};

nodeRegistry.register(registration);
