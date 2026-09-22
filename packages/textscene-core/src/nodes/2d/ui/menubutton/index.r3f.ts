/**
 * MenuButton registration — native (WebGL canvas) painter + rect solver.
 * `menu_button.cpp` draws and sizes exactly as its `Button` base does (see
 * `nativeSolver.ts`'s own doc for the one theme divergence this slice ports).
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { MenuButton } from './Component';
import { menuButtonMinimumSize } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'MenuButton', Component: MenuButton });
controlSolverRegistry.registerMinimumSize('MenuButton', menuButtonMinimumSize);

export { MenuButton };
