/**
 * HSplitContainer's native (WebGL canvas) rect solve — the shared
 * SplitContainer port at `vertical = false`. Registration only; the algorithm
 * itself lives once in `../shared/splitContainerSolver.ts` for both HSplit
 * and VSplit.
 */

import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import {
  makeSplitContainerLayout,
  makeSplitContainerMinimumSize,
  splitContainerTextureSlots,
} from '../shared/splitContainerSolver';

controlSolverRegistry.registerContainerLayout('HSplitContainer', makeSplitContainerLayout(false));
controlSolverRegistry.registerMinimumSize('HSplitContainer', makeSplitContainerMinimumSize(false));
controlSolverRegistry.registerTextureSlots('HSplitContainer', splitContainerTextureSlots);
