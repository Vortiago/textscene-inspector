/**
 * PhysicalBoneSimulator3D registration: the parser. It reuses the Node3D parse, and linterParser.ts
 * holds the property knowledge. PhysicalBoneSimulator3D's Godot effect is not implemented here
 * yet (ADR-0045), so index.r3f.ts registers Node3D as `pending` to keep its children in the
 * right transform space.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode3D } from '../../../base/node3d/parser';

const physicalBoneSimulator3DRegistration: NodeTypeRegistration = {
  typeName: 'PhysicalBoneSimulator3D',
  parser: parseNode3D,
};

nodeRegistry.register(physicalBoneSimulator3DRegistration);

export { physicalBoneSimulator3DRegistration };
