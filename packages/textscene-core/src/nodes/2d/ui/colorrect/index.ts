/** ColorRect registration: the parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseColorRect } from './parser';

const colorRectRegistration: NodeTypeRegistration = {
  typeName: 'ColorRect',
  parser: parseColorRect,
};

nodeRegistry.register(colorRectRegistration);

export { colorRectRegistration };
export * from './parser';
export * from './types';
