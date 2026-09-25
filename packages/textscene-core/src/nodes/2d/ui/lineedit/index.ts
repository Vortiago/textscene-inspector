/** Registers the LineEdit parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseLineEdit } from './parser';

const lineEditRegistration: NodeTypeRegistration = {
  typeName: 'LineEdit',
  parser: parseLineEdit,
};

nodeRegistry.register(lineEditRegistration);

export { lineEditRegistration };
export * from './parser';
export * from './displayText';
export * from './types';
