/** Camera2D registration: parser and formatter. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseCamera2D } from './parser';
import { formatCamera2DProperties } from './propertyFormatter';

const camera2DRegistration: NodeTypeRegistration = {
  typeName: 'Camera2D',
  parser: parseCamera2D,
  propertyFormatter: formatCamera2DProperties,
};

nodeRegistry.register(camera2DRegistration);

export { camera2DRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';
