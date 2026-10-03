/**
 * SpringArm3D parser registration: reuses the Node3D parse. Property knowledge
 * lives in linterParser.ts. Its Godot effect is not implemented here yet
 * (ADR-0045), so index.r3f.ts registers Node3D as `pending`.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode3D } from '../../../base/node3d/parser';

const springArm3DRegistration: NodeTypeRegistration = {
  typeName: 'SpringArm3D',
  parser: parseNode3D,
};

nodeRegistry.register(springArm3DRegistration);

export { springArm3DRegistration };
