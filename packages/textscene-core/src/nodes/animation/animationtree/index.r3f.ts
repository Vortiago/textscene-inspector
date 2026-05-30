/**
 * AnimationTree R3F component registration.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { AnimationTree } from './Component';

nodeComponentRegistry.register({
  typeName: 'AnimationTree',
  Component: AnimationTree,
});

export { AnimationTree };
