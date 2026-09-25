/**
 * What "the clip" means to an animated capture. Both sides sample the same
 * times, so these belong to neither of them.
 */

import { CANVAS_2D_CAPTURE } from '../../visual/previewServer.mjs';

export const FRAMES = 24; // over one loop of the clip
export const FPS = 12;

// A 2D animation renders at the project-viewport size (positions are absolute), then each
// frame is cropped to this viewport-centred window: a small GIF with the 3D animation's shape.
export const CROP_2D = {
  w: 640,
  h: 512,
  x: Math.round((CANVAS_2D_CAPTURE.width - 640) / 2),
  y: Math.round((CANVAS_2D_CAPTURE.height - 512) / 2),
};
