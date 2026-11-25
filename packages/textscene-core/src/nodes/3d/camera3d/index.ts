/**
 * Camera3D registration: the parser and formatter.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseCamera3D } from './parser';

const camera3DRegistration: NodeTypeRegistration = {
  typeName: 'Camera3D',
  parser: parseCamera3D,
};

nodeRegistry.register(camera3DRegistration);

export * from './parser';
export * from './types';
