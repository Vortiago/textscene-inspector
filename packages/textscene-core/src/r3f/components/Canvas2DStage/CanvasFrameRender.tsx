/**
 * Takes over the 2D canvas's render and draws each frame through the canvas frame, whose rows the
 * y-down camera (`world2DCamera.ts`) holds upside down. The project's `msaa_2d` sets the frame's
 * sample count: off, or on a device with no count at or below the mode's, the frame is single-sampled.
 */

import { useFrame, useThree } from '@react-three/fiber';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext.js';
import { CanvasFrame } from './canvasFrame.js';
import { useMultisampledTarget } from '../../multisampledTarget.js';

/** A positive priority stops R3F's own render, and runs after every pass at priority 0 or below. */
const OWNS_THE_RENDER = 1;

const createFrame = () => new CanvasFrame();

export function CanvasFrameRender() {
  const mode = useProjectSettings().msaaModes.msaa2D;
  const frame = useMultisampledTarget(mode, createFrame);
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  useFrame(() => frame.render(gl, scene, camera), OWNS_THE_RENDER);
  return null;
}
