/**
 * HBoxContainer's native (WebGL canvas) rect solve — the shared BoxContainer
 * port at `vertical = false`. Registration only; the algorithm itself lives
 * once in `../shared/boxContainerSolver.ts` for both HBox and VBox.
 */

import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { makeBoxContainerLayout, makeBoxContainerMinimumSize } from '../shared/boxContainerSolver';

controlSolverRegistry.registerContainerLayout('HBoxContainer', makeBoxContainerLayout(false));
controlSolverRegistry.registerMinimumSize('HBoxContainer', makeBoxContainerMinimumSize(false));
