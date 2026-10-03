/**
 * OpenXRRenderModel registration: the parser. It reuses the Node3D parse, and property knowledge lives
 * in linterParser.ts. Its Godot effect needs a live XR session the previewer does not run (ADR-0045), so
 * index.r3f.ts registers Node3D as `pending` and its children still land in the right
 * transform space.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode3D } from '../../../base/node3d/parser';

const openXRRenderModelRegistration: NodeTypeRegistration = {
  typeName: 'OpenXRRenderModel',
  parser: parseNode3D,
};

nodeRegistry.register(openXRRenderModelRegistration);

export { openXRRenderModelRegistration };
