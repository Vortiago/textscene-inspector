/** PathFollow2D registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parsePathFollow2D } from './parser';

const pathFollow2DRegistration: NodeTypeRegistration = {
  typeName: 'PathFollow2D',
  parser: parsePathFollow2D,
};

nodeRegistry.register(pathFollow2DRegistration);

export { pathFollow2DRegistration };
export * from './parser';
export * from './types';
