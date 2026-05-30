/** ColorRect registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseColorRect, isColorRect } from './parser';

const colorRectRegistration: NodeTypeRegistration = {
  typeName: 'ColorRect',
  typeGuard: isColorRect,
  parser: parseColorRect,
};

nodeRegistry.register(colorRectRegistration);

export { colorRectRegistration };
export * from './parser';
export * from './types';
