/**
 * HSlider registration — 2D-overlay DOM component, plus the native (WebGL
 * canvas) rect solve + painter. `./nativeSolver` registers the minimum-size
 * function as a side effect of import.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { HSlider } from './Component';
import { HSliderNative } from './NativeComponent';
import './nativeSolver';

controlComponentRegistry.register({ typeName: 'HSlider', Component: HSlider, Native: HSliderNative });

export { HSlider, HSliderNative };
