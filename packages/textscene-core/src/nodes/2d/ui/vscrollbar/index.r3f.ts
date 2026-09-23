/**
 * VScrollBar registration: the native (WebGL canvas) painter and rect solver.
 * Importing `./nativeSolver` registers the minimum-size function.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { VScrollBar } from './Component';
import './nativeSolver';

controlComponentRegistry.register({ typeName: 'VScrollBar', Component: VScrollBar });

export { VScrollBar };
