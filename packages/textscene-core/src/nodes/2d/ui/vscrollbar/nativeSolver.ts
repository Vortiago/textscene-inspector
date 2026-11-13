/**
 * VScrollBar's native (WebGL canvas) minimum-size solve: the shared ScrollBar port at
 * `vertical = true`, registered here. `../shared/scrollBarSolver.ts` holds the algorithm.
 */

import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import type { MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import { scrollBarBoxes } from '../shared/scrollBarBoxes';
import { scrollBarMinimumSize } from '../shared/scrollBarSolver';

const vScrollBarMinimumSize: MinimumSizeFn = (n) => scrollBarMinimumSize(true, scrollBarBoxes(n.styleBoxes));

controlSolverRegistry.registerMinimumSize('VScrollBar', vScrollBarMinimumSize);
