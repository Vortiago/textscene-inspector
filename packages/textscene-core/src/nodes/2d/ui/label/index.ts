/** Label registration: parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseLabel } from './parser';

const labelRegistration: NodeTypeRegistration = {
  typeName: 'Label',
  parser: parseLabel,
};

nodeRegistry.register(labelRegistration);

export * from './parser';
export * from './types';
