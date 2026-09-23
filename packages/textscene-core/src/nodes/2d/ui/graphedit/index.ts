/** GraphEdit registration: the parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseGraphEdit } from './parser';

const graphEditRegistration: NodeTypeRegistration = {
  typeName: 'GraphEdit',
  parser: parseGraphEdit,
};

nodeRegistry.register(graphEditRegistration);

export { graphEditRegistration };
export * from './parser';
export * from './types';
