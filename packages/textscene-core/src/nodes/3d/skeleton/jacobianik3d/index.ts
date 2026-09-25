/**
 * JacobianIK3D registration: the parser. It reuses the Node3D parse, and property knowledge
 * lives in linterParser.ts. It draws nothing by design (ADR-0008), so index.r3f.ts registers Node3D.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode3D } from '../../../base/node3d/parser';

const jacobianIK3DRegistration: NodeTypeRegistration = {
  typeName: 'JacobianIK3D',
  parser: parseNode3D,
};

nodeRegistry.register(jacobianIK3DRegistration);

export { jacobianIK3DRegistration };
