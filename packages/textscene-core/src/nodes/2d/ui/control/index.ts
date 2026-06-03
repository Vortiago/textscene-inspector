/** Control registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseControl } from './parser';

const controlRegistration: NodeTypeRegistration = {
  typeName: 'Control',
  parser: parseControl,
};

nodeRegistry.register(controlRegistration);

export { controlRegistration };
export * from './parser';
export * from './types';
