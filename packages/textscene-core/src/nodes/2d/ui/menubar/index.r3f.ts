/** Registers the MenuBar native painter and rect solver. `./nativeSolver` registers the minimum size on import. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { MenuBar } from './Component';
import { menuBarMinimumSize } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'MenuBar', Component: MenuBar });
controlSolverRegistry.registerMinimumSize('MenuBar', menuBarMinimumSize);

export { MenuBar };
