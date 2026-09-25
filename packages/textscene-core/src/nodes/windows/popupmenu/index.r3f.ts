/**
 * PopupMenu is parsed but not drawn. `nodeComponentRegistry.isPending` drives the "not
 * implemented" badge and the placeholder marker. `container: true` holds the type in
 * both canvases. The `Node` base applies no `visible`.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node } from '../../node/Component';

nodeComponentRegistry.register({
  typeName: 'PopupMenu',
  Component: Node,
  container: true,
  renderIntent: 'pending',
});
