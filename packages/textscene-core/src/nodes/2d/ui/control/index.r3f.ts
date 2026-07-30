/** Control registration — 2D-overlay DOM component + native (WebGL) painter. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { Control } from './Component';
import { ControlNative } from './NativeComponent';

controlComponentRegistry.register({ typeName: 'Control', Component: Control, Native: ControlNative });

export { Control, ControlNative };
