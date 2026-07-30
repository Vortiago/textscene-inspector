/** CanvasLayer registration — 2D-overlay DOM component + native (WebGL) painter. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { CanvasLayer } from './Component';
import { CanvasLayerNative } from './NativeComponent';

controlComponentRegistry.register({ typeName: 'CanvasLayer', Component: CanvasLayer, Native: CanvasLayerNative });

export { CanvasLayer, CanvasLayerNative };
