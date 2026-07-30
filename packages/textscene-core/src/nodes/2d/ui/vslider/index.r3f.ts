/**
 * VSlider registration — 2D-overlay DOM component, plus the native (WebGL
 * canvas) rect solve + painter. `./nativeSolver` registers the minimum-size
 * function as a side effect of import.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { VSlider } from './Component';
import { VSliderNative } from './NativeComponent';
import './nativeSolver';

controlComponentRegistry.register({ typeName: 'VSlider', Component: VSlider, Native: VSliderNative });

export { VSlider, VSliderNative };
