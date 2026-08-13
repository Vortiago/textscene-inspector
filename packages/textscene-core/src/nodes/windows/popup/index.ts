/**
 * Popup registration — parser.
 *
 * Reuses the Node parse; property knowledge lives in linterParser.ts.
 * Not rendered yet: index.r3f.ts registers Node under `renderIntent: 'pending'`,
 * so the tree still reports a gap while `visible` and the workspace split work.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode } from '../../node/parser';

const popupRegistration: NodeTypeRegistration = {
  typeName: 'Popup',
  parser: parseNode,
};

nodeRegistry.register(popupRegistration);

export { popupRegistration };
