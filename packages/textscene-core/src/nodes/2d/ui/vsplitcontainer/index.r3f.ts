/**
 * VSplitContainer registration: the native (WebGL canvas) rect solve and painter.
 * `./nativeSolver` registers the container-layout and minimum-size functions on import.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { VSplitContainer } from './Component';
import './nativeSolver';

controlComponentRegistry.register({
  typeName: 'VSplitContainer',
  Component: VSplitContainer,
});

export { VSplitContainer };
