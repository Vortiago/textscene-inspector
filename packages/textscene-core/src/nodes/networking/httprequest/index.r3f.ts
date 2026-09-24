/**
 * HTTPRequest draws nothing of its own (ADR-0008), so it reuses the Node
 * component and its children still land in the right transform space.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node } from '../../node/Component';

nodeComponentRegistry.register({
  typeName: 'HTTPRequest',
  Component: Node,
  container: true,
  renderIntent: 'transform-only',
});
