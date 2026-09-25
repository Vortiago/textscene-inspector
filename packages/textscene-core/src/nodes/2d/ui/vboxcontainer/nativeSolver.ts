/**
 * VBoxContainer's native (WebGL canvas) rect solve: the shared BoxContainer port at
 * `vertical = true`, registered here. `../shared/boxContainerSolver.ts` holds the algorithm.
 */

import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { makeBoxContainerLayout, makeBoxContainerMinimumSize } from '../shared/boxContainerSolver';

controlSolverRegistry.registerContainerLayout('VBoxContainer', makeBoxContainerLayout(true));
controlSolverRegistry.registerMinimumSize('VBoxContainer', makeBoxContainerMinimumSize(true));
