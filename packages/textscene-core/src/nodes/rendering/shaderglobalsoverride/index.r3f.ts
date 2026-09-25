/**
 * ShaderGlobalsOverride draws nothing of its own (ADR-0008): the Node component keeps
 * its children in the right transform space.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node } from '../../node/Component';

nodeComponentRegistry.register({
  typeName: 'ShaderGlobalsOverride',
  Component: Node,
  container: true,
  renderIntent: 'transform-only',
});
