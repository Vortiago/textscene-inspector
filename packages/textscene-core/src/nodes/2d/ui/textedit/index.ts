/** TextEdit registration: the parser. Render wiring lives in `index.r3f.ts`. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseTextEdit } from './parser';

const textEditRegistration: NodeTypeRegistration = {
  typeName: 'TextEdit',
  parser: parseTextEdit,
};

nodeRegistry.register(textEditRegistration);

export { textEditRegistration };
