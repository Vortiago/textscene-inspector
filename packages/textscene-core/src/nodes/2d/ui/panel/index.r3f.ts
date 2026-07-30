/** Panel registration — 2D-overlay DOM component + native (WebGL) painter. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { Panel } from './Component';
import { PanelNative } from './NativeComponent';

controlComponentRegistry.register({ typeName: 'Panel', Component: Panel, Native: PanelNative });

export { Panel, PanelNative };
