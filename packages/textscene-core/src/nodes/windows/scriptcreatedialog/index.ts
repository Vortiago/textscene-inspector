/**
 * ScriptCreateDialog parser registration: reuses the Node parse. Property knowledge lives in
 * linterParser.ts. index.r3f.ts registers it as pending, so the tree reports the gap.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode } from '../../node/parser';

const scriptCreateDialogRegistration: NodeTypeRegistration = {
  typeName: 'ScriptCreateDialog',
  parser: parseNode,
};

nodeRegistry.register(scriptCreateDialogRegistration);

export { scriptCreateDialogRegistration };
