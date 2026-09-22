/**
 * VScrollBar registration — the native (WebGL canvas) rect solve + painter.
 * `./nativeSolver` registers the minimum-size function as a side effect of
 * import.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { VScrollBar } from './Component';
import './nativeSolver';

controlComponentRegistry.register({ typeName: 'VScrollBar', Component: VScrollBar });

export { VScrollBar };
