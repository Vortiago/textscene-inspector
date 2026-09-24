/**
 * SpringArm3D parser registration: reuses the Node3D parse. Property knowledge
 * lives in linterParser.ts. It draws nothing by design (ADR-0008).
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode3D } from '../../../base/node3d/parser';

const springArm3DRegistration: NodeTypeRegistration = {
  typeName: 'SpringArm3D',
  parser: parseNode3D,
};

nodeRegistry.register(springArm3DRegistration);

export { springArm3DRegistration };
