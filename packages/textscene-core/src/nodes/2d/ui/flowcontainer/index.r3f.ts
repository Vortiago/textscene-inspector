/**
 * FlowContainer registration: the native rect solve and painter. Importing
 * `./nativeSolver` registers its functions for all three flow types, and the
 * `hflowcontainer` and `vflowcontainer` entries import it too.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { FlowContainer } from './Component';
import './nativeSolver';

controlComponentRegistry.register({
  typeName: 'FlowContainer',
  Component: FlowContainer,
});

export { FlowContainer };
