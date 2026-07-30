/**
 * ConfirmationDialog registration — parser.
 *
 * Reuses the Node parse; property knowledge lives in linterParser.ts.
 * Not rendered yet, so it registers NO component: the dispatcher falls back to
 * GenericNodeFallback and the tree keeps reporting it as not implemented.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode } from '../../node/parser';

const confirmationDialogRegistration: NodeTypeRegistration = {
  typeName: 'ConfirmationDialog',
  parser: parseNode,
};

nodeRegistry.register(confirmationDialogRegistration);

export { confirmationDialogRegistration };
