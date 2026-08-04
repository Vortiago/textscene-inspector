/**
 * FileDialog registration — parser.
 *
 * Reuses the Node parse; property knowledge lives in linterParser.ts.
 * Not rendered yet, so it registers NO component: the dispatcher falls back to
 * GenericNodeFallback and the tree keeps reporting it as not implemented.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode } from '../../node/parser';

const fileDialogRegistration: NodeTypeRegistration = {
  typeName: 'FileDialog',
  parser: parseNode,
};

nodeRegistry.register(fileDialogRegistration);

export { fileDialogRegistration };
