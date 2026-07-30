/**
 * VSlider's native (WebGL canvas) minimum-size solve — the shared Slider port
 * at `vertical = true`. Registration only; the algorithm itself lives once
 * in `../shared/sliderSolver.ts` for both HSlider and VSlider.
 */

import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import type { MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import { sliderMinimumSize } from '../shared/sliderSolver';

export const vSliderMinimumSize: MinimumSizeFn = (_n, ctx) => sliderMinimumSize(true, ctx.theme);

controlSolverRegistry.registerMinimumSize('VSlider', vSliderMinimumSize);
