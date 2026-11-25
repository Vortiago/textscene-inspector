/** Label3D parser and formatter registration. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseLabel3D } from './parser';

const label3DRegistration: NodeTypeRegistration = {
  typeName: 'Label3D',
  parser: parseLabel3D,
};

nodeRegistry.register(label3DRegistration);

export * from './parser';
export * from './types';
