/**
 * AspectRatioContainer registration — the native (WebGL canvas) rect solve +
 * painter. `./nativeSolver` registers the container-layout/minimum-size
 * functions as a side effect of import.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { AspectRatioContainer } from './Component';
import './nativeSolver';

controlComponentRegistry.register({
  typeName: 'AspectRatioContainer',
  Component: AspectRatioContainer,
});

export { AspectRatioContainer };
