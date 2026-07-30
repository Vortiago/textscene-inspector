/**
 * VBoxContainer's native (WebGL canvas) rect solve — the shared BoxContainer
 * port at `vertical = true`. Registration only; the algorithm itself lives
 * once in `../shared/boxContainerSolver.ts` for both HBox and VBox.
 */

import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { makeBoxContainerLayout, makeBoxContainerMinimumSize } from '../shared/boxContainerSolver';

controlSolverRegistry.registerContainerLayout('VBoxContainer', makeBoxContainerLayout(true));
controlSolverRegistry.registerMinimumSize('VBoxContainer', makeBoxContainerMinimumSize(true));
