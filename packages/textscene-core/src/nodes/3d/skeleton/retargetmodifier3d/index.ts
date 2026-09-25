/**
 * RetargetModifier3D registration: the parser. It reuses the Node3D parse, and linterParser.ts
 * holds the property knowledge. RetargetModifier3D draws nothing (ADR-0008), so index.r3f.ts
 * registers Node3D to keep its children in the right transform space.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode3D } from '../../../base/node3d/parser';

const retargetModifier3DRegistration: NodeTypeRegistration = {
  typeName: 'RetargetModifier3D',
  parser: parseNode3D,
};

nodeRegistry.register(retargetModifier3DRegistration);

export { retargetModifier3DRegistration };
