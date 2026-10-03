/**
 * ShaderGlobalsOverride overrides global shader parameters for every material that
 * reads them. That effect is a gap here (ADR-0045), so it registers `pending` on the
 * Node component, which keeps its children in the right transform space.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node } from '../../node/Component';

nodeComponentRegistry.register({
  typeName: 'ShaderGlobalsOverride',
  Component: Node,
  container: true,
  renderIntent: 'pending',
});
