/**
 * GridContainer registration — 2D-overlay DOM component, plus the native
 * (WebGL canvas) rect solve + painter. `./nativeSolver` registers the
 * container-layout/minimum-size functions as a side effect of import.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { GridContainer } from './Component';
import { GridContainerNative } from './NativeComponent';
import './nativeSolver';

controlComponentRegistry.register({
  typeName: 'GridContainer',
  Component: GridContainer,
  Native: GridContainerNative,
});

export { GridContainer };
