/** OptionButton registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseOptionButton } from './parser';

const optionButtonRegistration: NodeTypeRegistration = {
  typeName: 'OptionButton',
  parser: parseOptionButton,
};

nodeRegistry.register(optionButtonRegistration);

export { optionButtonRegistration };
export * from './parser';
export * from './types';
