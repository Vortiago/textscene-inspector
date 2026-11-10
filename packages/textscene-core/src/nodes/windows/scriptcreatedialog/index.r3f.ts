/**
 * ScriptCreateDialog is an editor class, so a game cannot create it and draws nothing for it
 * (`class_db.cpp:579-581`). The `Node` base keeps its children in the right transform space,
 * and `container: true` holds the type in both canvases.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node } from '../../node/Component';

nodeComponentRegistry.register({
  typeName: 'ScriptCreateDialog',
  Component: Node,
  container: true,
  renderIntent: 'transform-only',
});
