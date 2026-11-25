/** OmniLight3D parser and formatter registration. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseOmniLight3D } from './parser';

const omniLight3DRegistration: NodeTypeRegistration = {
  typeName: 'OmniLight3D',
  parser: parseOmniLight3D,
};

nodeRegistry.register(omniLight3DRegistration);

export * from './parser';
export * from './types';
