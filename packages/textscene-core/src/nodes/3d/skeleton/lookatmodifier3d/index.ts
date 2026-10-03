/**
 * LookAtModifier3D registration: the parser. It reuses the Node3D parse, and property knowledge
 * lives in linterParser.ts. Its Godot runtime effect is not implemented here yet (ADR-0045), so
 * index.r3f.ts registers Node3D as `pending`.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode3D } from '../../../base/node3d/parser';

const lookAtModifier3DRegistration: NodeTypeRegistration = {
  typeName: 'LookAtModifier3D',
  parser: parseNode3D,
};

nodeRegistry.register(lookAtModifier3DRegistration);

export { lookAtModifier3DRegistration };
