/** CopyTransformModifier3D registration: the parser, which reads `active` and `influence` and the `settings/<i>/` entries. index.r3f.ts holds its effect on the pose. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseCopyTransformModifier3D } from './parser';

const registration: NodeTypeRegistration = {
  typeName: 'CopyTransformModifier3D',
  parser: parseCopyTransformModifier3D,
};

nodeRegistry.register(registration);
