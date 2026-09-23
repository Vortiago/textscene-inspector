/** DirectionalLight3D parser and formatter registration. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseDirectionalLight3D } from './parser';
import { formatDirectionalLight3DProperties } from './propertyFormatter';

const directionalLight3DRegistration: NodeTypeRegistration = {
  typeName: 'DirectionalLight3D',
  parser: parseDirectionalLight3D,
  propertyFormatter: formatDirectionalLight3DProperties,
};

nodeRegistry.register(directionalLight3DRegistration);

export { directionalLight3DRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';
