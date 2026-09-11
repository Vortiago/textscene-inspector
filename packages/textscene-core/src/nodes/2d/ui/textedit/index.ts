/** TextEdit registration — parser. Render component wiring is `index.r3f.ts`'s job. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseTextEdit } from './parser';

const textEditRegistration: NodeTypeRegistration = {
  typeName: 'TextEdit',
  parser: parseTextEdit,
};

nodeRegistry.register(textEditRegistration);

export { textEditRegistration };
