/** SpotLight3D parser and formatter registration. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseSpotLight3D } from './parser';

const spotLight3DRegistration: NodeTypeRegistration = {
  typeName: 'SpotLight3D',
  parser: parseSpotLight3D,
};

nodeRegistry.register(spotLight3DRegistration);

export * from './parser';
export * from './types';
