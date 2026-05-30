/** Control registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseControl, isControl } from './parser';

const controlRegistration: NodeTypeRegistration = {
  typeName: 'Control',
  typeGuard: isControl,
  parser: parseControl,
};

nodeRegistry.register(controlRegistration);

export { controlRegistration };
export * from './parser';
export * from './types';
