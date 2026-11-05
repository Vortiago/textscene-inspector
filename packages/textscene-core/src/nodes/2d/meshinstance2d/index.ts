/**
 * MeshInstance2D registration: the parser. linterParser.ts holds the property validators.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseMeshInstance2D } from './parser';
import { formatMeshInstance2DProperties } from './propertyFormatter';

const meshInstance2DRegistration: NodeTypeRegistration = {
  typeName: 'MeshInstance2D',
  parser: parseMeshInstance2D,
  propertyFormatter: formatMeshInstance2DProperties,
};

nodeRegistry.register(meshInstance2DRegistration);

export * from './parser';
export * from './propertyFormatter';
export * from './types';
