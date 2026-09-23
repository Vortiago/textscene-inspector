/** CodeEdit registration: the parser. `index.r3f.ts` wires the render component. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseCodeEdit } from './parser';

const codeEditRegistration: NodeTypeRegistration = {
  typeName: 'CodeEdit',
  parser: parseCodeEdit,
};

nodeRegistry.register(codeEditRegistration);

export { codeEditRegistration };
