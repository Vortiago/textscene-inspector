/**
 * AnimationPlayer R3F component registration.
 */

import { nodeComponentRegistry } from '../../../NodeComponentRegistry';
import { AnimationPlayer } from './Component';

nodeComponentRegistry.register({
  typeName: 'AnimationPlayer',
  Component: AnimationPlayer,
});

export { AnimationPlayer };
