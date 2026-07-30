/**
 * HSlider's native (WebGL canvas) minimum-size solve — the shared Slider port
 * at `vertical = false`. Registration only; the algorithm itself lives once
 * in `../shared/sliderSolver.ts` for both HSlider and VSlider.
 */

import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import type { MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import { sliderMinimumSize } from '../shared/sliderSolver';

export const hSliderMinimumSize: MinimumSizeFn = (_n, ctx) => sliderMinimumSize(false, ctx.theme);

controlSolverRegistry.registerMinimumSize('HSlider', hSliderMinimumSize);
