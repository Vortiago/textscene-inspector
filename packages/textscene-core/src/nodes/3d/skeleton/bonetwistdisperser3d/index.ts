/**
 * BoneTwistDisperser3D registration: the parser. It reuses the Node3D parse, and property knowledge
 * lives in linterParser.ts. Its Godot runtime effect is not implemented here yet (ADR-0045), so index.r3f.ts registers Node3D as `pending`.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode3D } from '../../../base/node3d/parser';

const boneTwistDisperser3DRegistration: NodeTypeRegistration = {
  typeName: 'BoneTwistDisperser3D',
  parser: parseNode3D,
};

nodeRegistry.register(boneTwistDisperser3DRegistration);

export { boneTwistDisperser3DRegistration };
