/**
 * NavigationAgent2D draws nothing of its own (ADR-0008). It reuses the Node
 * component, so its children still land in the right transform space.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node } from '../../node/Component';

nodeComponentRegistry.register({
  typeName: 'NavigationAgent2D',
  Component: Node,
  container: true,
  renderIntent: 'transform-only',
});
