/**
 * AnimationPlayer R3F component registration.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { AnimationPlayer } from './Component';

nodeComponentRegistry.register({
  typeName: 'AnimationPlayer',
  Component: AnimationPlayer,
  container: true,
});

export { AnimationPlayer };
