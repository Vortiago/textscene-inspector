/** SpotLight3D parser and formatter registration. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseSpotLight3D } from './parser';
import { formatSpotLight3DProperties } from './propertyFormatter';

const spotLight3DRegistration: NodeTypeRegistration = {
  typeName: 'SpotLight3D',
  parser: parseSpotLight3D,
  propertyFormatter: formatSpotLight3DProperties,
};

nodeRegistry.register(spotLight3DRegistration);

export { spotLight3DRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';
