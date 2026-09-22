/**
 * HSlider's native (WebGL canvas) minimum-size solve — the shared Slider port
 * at `vertical = false`. Registration only; the algorithm itself lives once
 * in `../shared/sliderSolver.ts` for both HSlider and VSlider.
 */

import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import type { MinimumSizeFn, TextureSlotRequest, TextureSlotsFn } from '../../../../r3f/controls/native/solverRegistry';
import { sliderGrabberIconSize, sliderMinimumSize } from '../shared/sliderSolver';

/** `grabber_icon` (`Theme::DATA_TYPE_ICON` under key `"grabber"`) — the one themeable slot the min-size solve reads. */
export const hSliderTextureSlots: TextureSlotsFn = (_node, themedIcons = {}) => {
  const themed = themedIcons.grabber;
  const requests: TextureSlotRequest[] = [];
  if (themed) requests.push({ key: 'grabber', ref: themed.ref, scope: themed.resources });
  return requests;
};

export const hSliderMinimumSize: MinimumSizeFn = (n, ctx) =>
  sliderMinimumSize(false, ctx.theme, sliderGrabberIconSize(ctx.theme, n.textureSlots));

controlSolverRegistry.registerMinimumSize('HSlider', hSliderMinimumSize);
controlSolverRegistry.registerTextureSlots('HSlider', hSliderTextureSlots);
