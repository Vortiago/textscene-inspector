/**
 * Registers the MenuButton native painter and rect solver. `menu_button.cpp` draws and sizes as its
 * `Button` base does, but for one theme colour (`nativeSolver.ts`).
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { MenuButton } from './Component';
import { menuButtonMinimumSize } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'MenuButton', Component: MenuButton });
controlSolverRegistry.registerMinimumSize('MenuButton', menuButtonMinimumSize);

export { MenuButton };
