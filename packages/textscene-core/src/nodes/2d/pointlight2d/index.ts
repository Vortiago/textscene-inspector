/** Registers the PointLight2D parser and property formatter. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parsePointLight2D } from './parser';
import { formatPointLight2DProperties } from './propertyFormatter';

const pointLight2DRegistration: NodeTypeRegistration = {
  typeName: 'PointLight2D',
  parser: parsePointLight2D,
  propertyFormatter: formatPointLight2DProperties,
};

nodeRegistry.register(pointLight2DRegistration);

export { pointLight2DRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';
