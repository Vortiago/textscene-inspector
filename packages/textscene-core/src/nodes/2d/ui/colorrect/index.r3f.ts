/** ColorRect registration — 2D-overlay DOM component + native (WebGL) painter. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { ColorRect } from './Component';
import { ColorRectNative } from './NativeComponent';

controlComponentRegistry.register({ typeName: 'ColorRect', Component: ColorRect, Native: ColorRectNative });

export { ColorRect, ColorRectNative };
