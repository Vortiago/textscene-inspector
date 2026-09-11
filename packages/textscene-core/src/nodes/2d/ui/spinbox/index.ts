/** SpinBox registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseSpinBox } from './parser';

const spinBoxRegistration: NodeTypeRegistration = {
  typeName: 'SpinBox',
  parser: parseSpinBox,
};

nodeRegistry.register(spinBoxRegistration);

export { spinBoxRegistration };
export * from './parser';
export * from './types';
