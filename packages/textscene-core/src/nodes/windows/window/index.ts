/**
 * Window parser registration: reuses the Node parse. Property knowledge lives in
 * linterParser.ts. index.r3f.ts registers it as pending, so the tree reports the gap.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode } from '../../node/parser';

const windowRegistration: NodeTypeRegistration = {
  typeName: 'Window',
  parser: parseNode,
};

nodeRegistry.register(windowRegistration);

export { windowRegistration };
