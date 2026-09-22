/** GraphElement registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseGraphElement } from './parser';

const graphElementRegistration: NodeTypeRegistration = {
  typeName: 'GraphElement',
  parser: parseGraphElement,
};

nodeRegistry.register(graphElementRegistration);

export { graphElementRegistration };
export * from './parser';
export * from './types';
