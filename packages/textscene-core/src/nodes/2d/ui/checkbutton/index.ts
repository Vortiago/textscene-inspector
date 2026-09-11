/** CheckButton registration: parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseCheckButton } from './parser';

const checkButtonRegistration: NodeTypeRegistration = {
  typeName: 'CheckButton',
  parser: parseCheckButton,
};

nodeRegistry.register(checkButtonRegistration);

export { checkButtonRegistration };
