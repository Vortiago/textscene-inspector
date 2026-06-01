/** Camera2D registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseCamera2D, isCamera2D } from './parser';

const camera2DRegistration: NodeTypeRegistration = {
  typeName: 'Camera2D',
  typeGuard: isCamera2D,
  parser: parseCamera2D,
};

nodeRegistry.register(camera2DRegistration);

export { camera2DRegistration };
export * from './parser';
export * from './types';
