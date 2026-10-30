/** BoneConstraint3D registration: the parser, which reads `active` and `influence` and the base `settings/<i>/` leaves. index.r3f.ts holds its effect on the pose. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseBoneConstraint3D } from './parser';

const registration: NodeTypeRegistration = {
  typeName: 'BoneConstraint3D',
  parser: parseBoneConstraint3D,
};

nodeRegistry.register(registration);
