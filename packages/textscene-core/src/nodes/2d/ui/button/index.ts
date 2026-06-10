/** Button registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseButton } from './parser';

const buttonRegistration: NodeTypeRegistration = {
  typeName: 'Button',
  parser: parseButton,
};

nodeRegistry.register(buttonRegistration);

export { buttonRegistration };
export * from './parser';
export * from './types';
