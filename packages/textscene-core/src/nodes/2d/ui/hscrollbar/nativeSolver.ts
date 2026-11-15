/**
 * HScrollBar's native (WebGL canvas) minimum-size solve: the shared
 * ScrollBar port at `vertical = false`. Registration only; the algorithm
 * itself lives once in `../shared/scrollBarSolver.ts` for both HScrollBar and
 * VScrollBar.
 */

import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import type { MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import { scrollBarBoxes } from '../shared/scrollBarBoxes';
import { scrollBarMinimumSize } from '../shared/scrollBarSolver';

const hScrollBarMinimumSize: MinimumSizeFn = (n) => scrollBarMinimumSize(false, scrollBarBoxes(n.styleBoxes));

controlSolverRegistry.registerMinimumSize('HScrollBar', hScrollBarMinimumSize);
