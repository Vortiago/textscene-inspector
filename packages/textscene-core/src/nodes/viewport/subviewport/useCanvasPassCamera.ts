/**
 * The camera a 2D pass draws a sub-viewport's canvas through, shared by the pass for 2D-world
 * content and the pass for Controls.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { createViewportCanvasCamera } from '../../../r3f/sceneRenderCamera';
import { applyOrthoFrame, orthoFrameForSize } from './offscreenViewport';
import type { Vector2 } from '../../../godot/math/vector';

/**
 * A persistent camera that frames the whole target of `size` until a pass narrows it. It holds the
 * canvas top at GL row 0, so its pass draws through a `CanvasFrame` (ADR-0057).
 *
 * @oneWay The camera of a sub-viewport's 2D pass
 */
export function useCanvasPassCamera(size: Vector2): THREE.OrthographicCamera {
  const camera = useMemo(() => createViewportCanvasCamera(), []);
  const { x: width, y: height } = size;
  useEffect(() => {
    camera.near = 0.1;
    camera.far = 4000;
    applyOrthoFrame(camera, orthoFrameForSize({ x: width, y: height }));
  }, [camera, width, height]);
  return camera;
}
