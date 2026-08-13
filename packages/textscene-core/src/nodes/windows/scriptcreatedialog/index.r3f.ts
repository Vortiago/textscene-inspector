/**
 * ScriptCreateDialog draws nothing here YET — the badge reads "not implemented". The
 * Node base still mounts, for `visible` and the workspace split.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node } from '../../node/Component';

nodeComponentRegistry.register({
  typeName: 'ScriptCreateDialog',
  Component: Node,
  container: true,
  renderIntent: 'pending',
});
