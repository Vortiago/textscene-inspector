/**
 * XRBodyModifier3D registration: the parser. It reuses the Node3D parse, and linterParser.ts holds
 * the property knowledge. XRBodyModifier3D's Godot effect is not implemented here yet (ADR-0045),
 * so index.r3f.ts registers Node3D as `pending` to keep its children in the right transform space.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode3D } from '../../../base/node3d/parser';

const xRBodyModifier3DRegistration: NodeTypeRegistration = {
  typeName: 'XRBodyModifier3D',
  parser: parseNode3D,
};

nodeRegistry.register(xRBodyModifier3DRegistration);

export { xRBodyModifier3DRegistration };
