/**
 * Takes over the 2D canvas's render while the project's `msaa_2d` turns MSAA on, and draws each frame
 * through the multisampled frame. Off, or on a device with no count at or below the mode's, it mounts
 * nothing, and R3F draws to the drawing buffer.
 */

import { useFrame, useThree } from '@react-three/fiber';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext.js';
import { CanvasMsaaFrame } from './canvasMsaaFrame.js';
import { useMultisampledTarget } from '../../multisampledTarget.js';
import { MSAA_DISABLED } from '../../../godot/rendering/msaa.js';

/** A positive priority stops R3F's own render, and runs after every pass at priority 0 or below. */
const OWNS_THE_RENDER = 1;

const createFrame = () => new CanvasMsaaFrame();

export function CanvasMsaa() {
  const mode = useProjectSettings().msaaModes.msaa2D;
  return mode === MSAA_DISABLED ? null : <MultisampledFrame mode={mode} />;
}

function MultisampledFrame({ mode }: { mode: number }) {
  const frame = useMultisampledTarget(mode, createFrame);
  return frame.samples > 0 ? <MultisampledRender frame={frame} /> : null;
}

function MultisampledRender({ frame }: { frame: CanvasMsaaFrame }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  useFrame(() => frame.render(gl, scene, camera), OWNS_THE_RENDER);
  return null;
}
