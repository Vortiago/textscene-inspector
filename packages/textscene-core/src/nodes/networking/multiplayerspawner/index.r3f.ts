/**
 * MultiplayerSpawner draws nothing of its own (ADR-0008) — reuse the Node
 * component so its children still land in the right transform space.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node } from '../../node/Component';

nodeComponentRegistry.register({
  typeName: 'MultiplayerSpawner',
  Component: Node,
  container: true,
  renderIntent: 'transform-only',
});
