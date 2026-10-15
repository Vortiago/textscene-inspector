/**
 * Takes over the 2D canvas's render while the project's `msaa_2d` turns MSAA on, and draws each frame
 * through the multisampled frame. Off, or on a device with no count at or below the mode's, it mounts
 * nothing, and R3F draws to the drawing buffer.
 */

import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext.js';
import { createCanvasMsaaFrame } from './canvasMsaaFrame.js';
import { useDeviceSampleCount } from '../../deviceSampleCount.js';

/** A positive priority stops R3F's own render, and runs after every pass at priority 0 or below. */
const OWNS_THE_RENDER = 1;

export function CanvasMsaa() {
  const samples = useDeviceSampleCount(useProjectSettings().msaaSamples.msaa2D);
  return samples > 0 ? <MultisampledRender samples={samples} /> : null;
}

function MultisampledRender({ samples }: { samples: number }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const frame = useMemo(() => createCanvasMsaaFrame(samples), [samples]);
  useEffect(() => () => frame.dispose(), [frame]);
  useFrame(() => frame.render(gl, scene, camera), OWNS_THE_RENDER);
  return null;
}
