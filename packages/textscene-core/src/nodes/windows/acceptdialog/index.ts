/**
 * AcceptDialog parser registration: reuses the Node parse. Property knowledge lives
 * in linterParser.ts. It is not rendered yet: index.r3f.ts registers Node under
 * `renderIntent: 'pending'`, so the tree reports a gap.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode } from '../../node/parser';

const acceptDialogRegistration: NodeTypeRegistration = {
  typeName: 'AcceptDialog',
  parser: parseNode,
};

nodeRegistry.register(acceptDialogRegistration);

export { acceptDialogRegistration };
