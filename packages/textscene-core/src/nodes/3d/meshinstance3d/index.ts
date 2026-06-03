/**
 * MeshInstance3D registration — parser + property formatter.
 *
 * Imported for its side-effect by `parser/TscnParser.ts` so the parser
 * knows how to turn raw TSCN body properties into a `MeshInstance3DProperties`.
 * The R3F `<MeshInstance3D>` component (registered separately in
 * `r3f/nodes/meshinstance3d/index.ts`) handles the rendering.
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
