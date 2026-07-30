/**
 * HBoxContainer registration — 2D-overlay DOM component, plus the native
 * (WebGL canvas) rect solve + painter. `./nativeSolver` registers the
 * container-layout/minimum-size functions as a side effect of import.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { HBoxContainer } from './Component';
import { HBoxContainerNative } from './NativeComponent';
import './nativeSolver';

controlComponentRegistry.register({
  typeName: 'HBoxContainer',
  Component: HBoxContainer,
  Native: HBoxContainerNative,
});

export { HBoxContainer };
