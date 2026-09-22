/**
 * VScrollBar's native (WebGL canvas) minimum-size solve — the shared
 * ScrollBar port at `vertical = true`. Registration only; the algorithm
 * itself lives once in `../shared/scrollBarSolver.ts` for both HScrollBar and
 * VScrollBar.
 */

import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import type { MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import { scrollBarMinimumSize } from '../shared/scrollBarSolver';

export const vScrollBarMinimumSize: MinimumSizeFn = (_n, ctx) => scrollBarMinimumSize(true, ctx.theme);

controlSolverRegistry.registerMinimumSize('VScrollBar', vScrollBarMinimumSize);
