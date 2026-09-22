/** CodeEdit registration — parser. Render component wiring is `index.r3f.ts`'s job. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseCodeEdit } from './parser';

const codeEditRegistration: NodeTypeRegistration = {
  typeName: 'CodeEdit',
  parser: parseCodeEdit,
};

nodeRegistry.register(codeEditRegistration);

export { codeEditRegistration };
