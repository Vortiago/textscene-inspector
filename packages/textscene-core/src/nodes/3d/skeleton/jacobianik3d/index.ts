/**
 * JacobianIK3D registration: the parser. It reuses the Node3D parse, and property knowledge
 * lives in linterParser.ts. Its Godot runtime effect is not implemented here yet (ADR-0045), so
 * index.r3f.ts registers Node3D as `pending`.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode3D } from '../../../base/node3d/parser';

const jacobianIK3DRegistration: NodeTypeRegistration = {
  typeName: 'JacobianIK3D',
  parser: parseNode3D,
};

nodeRegistry.register(jacobianIK3DRegistration);

export { jacobianIK3DRegistration };
