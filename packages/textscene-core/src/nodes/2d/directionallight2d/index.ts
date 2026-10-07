/** Registers the DirectionalLight2D parser and property formatter. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseDirectionalLight2D } from './parser';
import { formatDirectionalLight2DProperties } from './propertyFormatter';

const directionalLight2DRegistration: NodeTypeRegistration = {
  typeName: 'DirectionalLight2D',
  parser: parseDirectionalLight2D,
  propertyFormatter: formatDirectionalLight2DProperties,
};

nodeRegistry.register(directionalLight2DRegistration);

export { directionalLight2DRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';
