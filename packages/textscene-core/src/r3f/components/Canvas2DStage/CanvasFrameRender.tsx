/**
 * Takes over the 2D canvas's render and runs each frame's steps (`canvasFrameSequence.ts`). The
 * draw goes through the canvas frame, whose rows the y-down camera (`world2DCamera.ts`) holds
 * upside down. The project's `msaa_2d` sets the frame's sample count: off, or on a device with no
 * count at or below the mode's, the frame is single-sampled. The project's `hdr_2d` sets its space:
 * a linear half-float frame, which the copy to the drawing buffer converts to sRGB. The camera and
 * this component go together: a `World2DCamera` drawn straight to the drawing buffer shows the
 * canvas upside down.
 */

import { useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useRootViewportDescription } from '../../viewportRender/useRootViewportDescription.js';
import { createCanvasFrame } from './canvasFrame.js';
import { useMultisampledTarget } from '../../offscreen/multisampledTarget.js';
import { viewportTransfer } from '../../texelCopy.js';
import { useRootCanvasColorSpace } from '../../rootCanvasColorSpace.js';
import { runCanvasFrame, type CanvasFrameSteps } from './canvasFrameSequence.js';

/**
 * A positive priority stops R3F's own render, and runs after every pass at priority 0 or below, so
 * the canvas frame sees the poses of the frame it draws.
 */
const OWNS_THE_RENDER = 1;

/** Draws the canvas through `steps`, the frame steps of the canvas it draws. */
export function CanvasFrameRender({ steps }: { steps: CanvasFrameSteps }) {
  const root = useRootViewportDescription();
  const space = useRootCanvasColorSpace();
  const createRootCanvasFrame = useCallback(() => createCanvasFrame(space), [space]);
  const frame = useMultisampledTarget(root.msaa2D, createRootCanvasFrame);
  const isTransparent = root.transparentBackground;
  // The drawing buffer takes sRGB numbers: the blit converts an HDR root's linear frame (`blit.glsl:136`).
  const colour = space.isLinear ? 'encode' : 'none';
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  useFrame(() => {
    runCanvasFrame(steps, () => frame.render(gl, scene, camera, viewportTransfer(colour, isTransparent)));
  }, OWNS_THE_RENDER);
  return null;
}
