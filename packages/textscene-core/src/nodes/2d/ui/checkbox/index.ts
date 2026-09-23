/** CheckBox registration: the parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseCheckBox } from './parser';

const checkBoxRegistration: NodeTypeRegistration = {
  typeName: 'CheckBox',
  parser: parseCheckBox,
};

nodeRegistry.register(checkBoxRegistration);

export { checkBoxRegistration };
export * from './parser';
export * from './types';
