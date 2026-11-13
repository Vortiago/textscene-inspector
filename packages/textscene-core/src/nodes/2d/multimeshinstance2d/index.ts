/**
 * MultiMeshInstance2D registration: the parser. linterParser.ts holds the property validators.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseMultiMeshInstance2D } from './parser';
import { formatMultiMeshInstance2DProperties } from './propertyFormatter';

const multiMeshInstance2DRegistration: NodeTypeRegistration = {
  typeName: 'MultiMeshInstance2D',
  parser: parseMultiMeshInstance2D,
  propertyFormatter: formatMultiMeshInstance2DProperties,
};

nodeRegistry.register(multiMeshInstance2DRegistration);

export * from './parser';
export * from './propertyFormatter';
export * from './types';
