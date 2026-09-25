/**
 * VBoxContainer registration: the native (WebGL canvas) painter and rect solver. Importing
 * `./nativeSolver` registers the container-layout and minimum-size functions.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { VBoxContainer } from './Component';
import './nativeSolver';

controlComponentRegistry.register({
  typeName: 'VBoxContainer',
  Component: VBoxContainer,
});

export { VBoxContainer };
