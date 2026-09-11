/**
 * MenuBar registration — the native (WebGL canvas) rect solve + painter.
 * `./nativeSolver` registers the minimum-size function as a side effect of
 * import.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { MenuBar } from './Component';
import { menuBarMinimumSize } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'MenuBar', Component: MenuBar });
controlSolverRegistry.registerMinimumSize('MenuBar', menuBarMinimumSize);

export { MenuBar };
