/** Tree registration — parser. Render component wiring is `index.r3f.ts`'s job. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseTree } from './parser';

const treeRegistration: NodeTypeRegistration = {
  typeName: 'Tree',
  parser: parseTree,
};

nodeRegistry.register(treeRegistration);

export { treeRegistration };
