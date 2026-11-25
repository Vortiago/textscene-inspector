/** Registers the Polygon2D parser and property formatter. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parsePolygon2D } from './parser';

const polygon2DRegistration: NodeTypeRegistration = {
  typeName: 'Polygon2D',
  parser: parsePolygon2D,
};

nodeRegistry.register(polygon2DRegistration);

export * from './parser';
export * from './types';
