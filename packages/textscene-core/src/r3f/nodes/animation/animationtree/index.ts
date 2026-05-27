/**
 * AnimationTree R3F component registration.
 */

import { nodeComponentRegistry } from '../../../NodeComponentRegistry';
import { AnimationTree } from './Component';

nodeComponentRegistry.register({
  typeName: 'AnimationTree',
  Component: AnimationTree,
});

export { AnimationTree };
