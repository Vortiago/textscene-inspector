/**
 * VSplitContainer's native (WebGL canvas) rect solve: the shared SplitContainer port at
 * `vertical = true`. The algorithm lives in `../shared/splitContainerSolver.ts` for both
 * orientations.
 */

import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import {
  makeSplitContainerLayout,
  makeSplitContainerMinimumSize,
  splitContainerTextureSlots,
} from '../shared/splitContainerSolver';

controlSolverRegistry.registerContainerLayout('VSplitContainer', makeSplitContainerLayout(true));
controlSolverRegistry.registerMinimumSize('VSplitContainer', makeSplitContainerMinimumSize(true));
controlSolverRegistry.registerTextureSlots('VSplitContainer', splitContainerTextureSlots);
