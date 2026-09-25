/**
 * Camera3D registration: the parser and formatter.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseCamera3D } from './parser';
import { formatCamera3DProperties } from './propertyFormatter';

const camera3DRegistration: NodeTypeRegistration = {
  typeName: 'Camera3D',
  parser: parseCamera3D,
  propertyFormatter: formatCamera3DProperties,
};

nodeRegistry.register(camera3DRegistration);

export { camera3DRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';
