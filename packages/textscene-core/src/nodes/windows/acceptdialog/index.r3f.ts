/**
 * AcceptDialog is parsed but not drawn. The registration declares that gap and nothing
 * more: `nodeComponentRegistry.isPending` drives the "not implemented" badge and the
 * group's placeholder marker. `container: true` holds the type in both canvases.
 * The `Node` base applies no `visible`.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node } from '../../node/Component';

nodeComponentRegistry.register({
  typeName: 'AcceptDialog',
  Component: Node,
  container: true,
  renderIntent: 'pending',
});
