/** Tree registration: the parser. Render wiring lives in `index.r3f.ts`. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseTree } from './parser';

const treeRegistration: NodeTypeRegistration = {
  typeName: 'Tree',
  parser: parseTree,
};

nodeRegistry.register(treeRegistration);

export { treeRegistration };
