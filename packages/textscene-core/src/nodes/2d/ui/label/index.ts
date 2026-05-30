/** Label registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseLabel, isLabel } from './parser';

const labelRegistration: NodeTypeRegistration = {
  typeName: 'Label',
  typeGuard: isLabel,
  parser: parseLabel,
};

nodeRegistry.register(labelRegistration);

export { labelRegistration };
export * from './parser';
export * from './types';
