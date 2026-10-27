/**
 * What a 2D pass of a sub-viewport draws through, shared by the pass for 2D-world content and the
 * pass for Controls: a camera that holds the canvas top at GL row 0, and the frame it draws into.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { createViewportCanvasCamera } from '../../../r3f/sceneRenderCamera';
import { createCanvasFrame } from '../../../r3f/components/Canvas2DStage/canvasFrame';
import { useMultisampledTarget } from '../../../r3f/multisampledTarget';
import { applyOrthoFrame, orthoFrameForSize } from './offscreenViewport';

/**
 * A persistent camera that frames the whole target until a pass narrows it, and the `CanvasFrame`
 * the pass draws through (ADR-0057). The frame takes the viewport's `msaa_2d` mode, so the target it
 * copies into never multisamples. A pass that draws no canvas passes mode 0.
 *
 * @canonical The camera and frame of a sub-viewport's 2D pass
 */
export function useCanvasPass(
  width: number,
  height: number,
  msaaMode: number
): { camera: THREE.OrthographicCamera; frame: ReturnType<typeof createCanvasFrame> } {
  const camera = useMemo(() => createViewportCanvasCamera(), []);
  useEffect(() => {
    camera.near = 0.1;
    camera.far = 4000;
    applyOrthoFrame(camera, orthoFrameForSize({ x: width, y: height }));
  }, [camera, width, height]);
  const frame = useMultisampledTarget(msaaMode, createCanvasFrame);
  return { camera, frame };
}
