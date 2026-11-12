/**
 * MultiMeshInstance3D registration: parser.
 *
 * Reuses the GeometryInstance3D parse, and property knowledge lives in linterParser.ts.
 * index.r3f.ts registers the component that draws it.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseGeometryInstance3D } from '../geometryinstance3d/parser';

const multiMeshInstance3DRegistration: NodeTypeRegistration = {
  typeName: 'MultiMeshInstance3D',
  parser: parseGeometryInstance3D,
};

nodeRegistry.register(multiMeshInstance3DRegistration);
