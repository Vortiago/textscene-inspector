/**
 * MultiMeshInstance3D registration: parser.
 *
 * Reuses the GeometryInstance3D parse, and property knowledge lives in linterParser.ts.
 * Not rendered: index.r3f.ts registers the base under `renderIntent: 'pending'`,
 * so the tree still reports a gap while `visible` and the workspace split work.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseGeometryInstance3D } from '../geometryinstance3d/parser';

const multiMeshInstance3DRegistration: NodeTypeRegistration = {
  typeName: 'MultiMeshInstance3D',
  parser: parseGeometryInstance3D,
};

nodeRegistry.register(multiMeshInstance3DRegistration);

export { multiMeshInstance3DRegistration };
