/**
 * MeshInstance3D registration: parser + property formatter. `parser/TscnParser.ts`
 * imports it for the side effect, so the parser can build a
 * `MeshInstance3DProperties`. index.r3f.ts registers the render component.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseMeshInstance3D } from './parser';
import { formatMeshInstance3DProperties } from './propertyFormatter';

const meshInstance3DRegistration: NodeTypeRegistration = {
  typeName: 'MeshInstance3D',
  parser: parseMeshInstance3D,
  propertyFormatter: formatMeshInstance3DProperties,
};

nodeRegistry.register(meshInstance3DRegistration);

export { meshInstance3DRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';
