/**
 * Takes over the 2D canvas's render while the project's `msaa_2d` turns MSAA on, and draws each frame
 * through the multisampled frame. Off, or on a device with no count at or below the mode's, it mounts
 * nothing, and R3F draws to the drawing buffer.
 */

import { useEffect, useMemo } from 'react';
import type * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext.js';
import { createCanvasMsaaFrame, createFrameTarget } from './canvasMsaaFrame.js';
import { useMultisampledTarget } from '../../multisampledTarget.js';

/** A positive priority stops R3F's own render, and runs after every pass at priority 0 or below. */
const OWNS_THE_RENDER = 1;

export function CanvasMsaa() {
  const target = useMultisampledTarget(useProjectSettings().msaaModes.msaa2D, createFrameTarget);
  return target.samples > 0 ? <MultisampledRender target={target} /> : null;
}

function MultisampledRender({ target }: { target: THREE.WebGLRenderTarget }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const frame = useMemo(() => createCanvasMsaaFrame(target), [target]);
  useEffect(() => () => frame.dispose(), [frame]);
  useFrame(() => frame.render(gl, scene, camera), OWNS_THE_RENDER);
  return null;
}
