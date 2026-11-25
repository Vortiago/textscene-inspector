/** DirectionalLight3D parser and formatter registration. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseDirectionalLight3D } from './parser';

const directionalLight3DRegistration: NodeTypeRegistration = {
  typeName: 'DirectionalLight3D',
  parser: parseDirectionalLight3D,
};

nodeRegistry.register(directionalLight3DRegistration);

export * from './parser';
export * from './types';
