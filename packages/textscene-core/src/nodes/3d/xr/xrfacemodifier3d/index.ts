/**
 * XRFaceModifier3D registration: the parser. It reuses the Node3D parse, and property knowledge lives
 * in linterParser.ts. Its Godot effect needs a live XR session the previewer does not run (ADR-0045), so
 * index.r3f.ts registers Node3D as `pending` and its children still land in the right
 * transform space.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode3D } from '../../../base/node3d/parser';

const xRFaceModifier3DRegistration: NodeTypeRegistration = {
  typeName: 'XRFaceModifier3D',
  parser: parseNode3D,
};

nodeRegistry.register(xRFaceModifier3DRegistration);

export { xRFaceModifier3DRegistration };
