/**
 * What a 2D pass of a sub-viewport draws through, shared by the pass for 2D-world content and the
 * pass for Controls: a camera that holds the canvas top at GL row 0, and the frame it draws into.
 */

import { useCallback, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { World2DCamera } from '../components/Canvas2DStage/world2DCamera';
import { createCanvasFrame } from '../components/Canvas2DStage/canvasFrame';
import { useMultisampledTarget } from '../offscreen/multisampledTarget';
import { applyOrthoFrame, orthoFrameForSize } from './viewportFraming';
import type { CanvasColorSpace } from '../canvasColorSpace';

/**
 * A persistent camera that frames the whole target until a pass narrows it, and the `CanvasFrame`
 * the pass draws through (ADR-0057). The frame takes the viewport's `msaa_2d` mode, so the target it
 * copies into never multisamples. A pass that draws no canvas passes mode 0. The frame draws in
 * `space`, the colour space of the target it copies into.
 *
 * @canonical The camera and frame of a sub-viewport's 2D pass
 */
export function useCanvasPass(
  width: number,
  height: number,
  msaaMode: number,
  space: CanvasColorSpace
): { camera: THREE.OrthographicCamera; frame: ReturnType<typeof createCanvasFrame> } {
  const camera = useMemo(() => new World2DCamera(), []);
  useEffect(() => {
    camera.near = 0.1;
    camera.far = 4000;
    applyOrthoFrame(camera, orthoFrameForSize({ x: width, y: height }));
  }, [camera, width, height]);
  const createFrame = useCallback(() => createCanvasFrame(space), [space]);
  const frame = useMultisampledTarget(msaaMode, createFrame);
  return { camera, frame };
}
