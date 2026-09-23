/** Registers the Polygon2D parser and property formatter. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parsePolygon2D } from './parser';
import { formatPolygon2DProperties } from './propertyFormatter';

const polygon2DRegistration: NodeTypeRegistration = {
  typeName: 'Polygon2D',
  parser: parsePolygon2D,
  propertyFormatter: formatPolygon2DProperties,
};

nodeRegistry.register(polygon2DRegistration);

export { polygon2DRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';
