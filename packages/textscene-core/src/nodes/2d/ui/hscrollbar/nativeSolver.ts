/**
 * HScrollBar's native (WebGL canvas) minimum-size solve — the shared
 * ScrollBar port at `vertical = false`. Registration only; the algorithm
 * itself lives once in `../shared/scrollBarSolver.ts` for both HScrollBar and
 * VScrollBar.
 */

import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import type { MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import { scrollBarMinimumSize } from '../shared/scrollBarSolver';

export const hScrollBarMinimumSize: MinimumSizeFn = (_n, ctx) => scrollBarMinimumSize(false, ctx.theme);

controlSolverRegistry.registerMinimumSize('HScrollBar', hScrollBarMinimumSize);
