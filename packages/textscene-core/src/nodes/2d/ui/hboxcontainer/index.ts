/** HBoxContainer registration: parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseHBoxContainer } from './parser';

const hBoxContainerRegistration: NodeTypeRegistration = {
  typeName: 'HBoxContainer',
  parser: parseHBoxContainer,
};

nodeRegistry.register(hBoxContainerRegistration);

export { hBoxContainerRegistration };
export * from './parser';
export * from './types';
