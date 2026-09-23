/**
 * VScrollBar's native (WebGL canvas) minimum-size solve: the shared ScrollBar port at
 * `vertical = true`, registered here. `../shared/scrollBarSolver.ts` holds the algorithm.
 */

import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import type { MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import { scrollBarMinimumSize } from '../shared/scrollBarSolver';

export const vScrollBarMinimumSize: MinimumSizeFn = (_n, ctx) => scrollBarMinimumSize(true, ctx.theme);

controlSolverRegistry.registerMinimumSize('VScrollBar', vScrollBarMinimumSize);
