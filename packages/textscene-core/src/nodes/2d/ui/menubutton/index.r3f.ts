/**
 * Registers the MenuButton native painter and rect solver. `menu_button.cpp` draws and sizes as its
 * `Button` base does, but for one theme colour (`nativeSolver.ts`).
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { isButtonNodeAutowrapped } from '../../../../r3f/controls/native/buttonBase';
import { MenuButton } from './Component';
import { menuButtonMinimumSize } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'MenuButton', Component: MenuButton });
controlSolverRegistry.registerMinimumSize('MenuButton', menuButtonMinimumSize);
// As Button's: a wrapping label's height depends on this node's own width.
controlSolverRegistry.registerSizeDependentMinimum('MenuButton', isButtonNodeAutowrapped);
