/**
 * Hands the active canvas's renderer to `ViewportActionsContext`, so the toolbar's Screenshot and
 * the host's capture read the scene that view renders, 3D or 2D. The 2D stage's DOM chrome is no
 * part of it. It renders and reads back in one task: WebGL clears the buffer only when the browser
 * composites, and `preserveDrawingBuffer` would copy the buffer every frame. It renders one frame of
 * the canvas's loop, not `gl.render`, so a pass that owns the render, the compositor or the 2D
 * multisampled frame, draws what the canvas shows.
 */

import { useThree, type RootState } from '@react-three/fiber';
import { useEffect } from 'react';
import { useOptionalViewportActions } from './contexts/ViewportActionsContext.js';
import { useOptionalHierarchy } from './contexts/HierarchyContext.js';

/**
 * The time a capture's frame runs at. A stopped loop (the preview is hidden) takes its time from the
 * timestamp, so the clock's own time makes the delta zero: an animation and particles hold the pose
 * they paused in. One frame is enough: scenes with a shadowed 2D light, a SubViewport and a
 * CanvasGroup, hidden from the start, capture pixel for pixel as a visible one does.
 */
function frameTimestamp({ frameloop, clock }: Pick<RootState, 'frameloop' | 'clock'>): number {
  return frameloop === 'never' ? clock.elapsedTime : performance.now();
}

/**
 * Mount it after the scene's contents, so its effect runs after theirs have asked for their
 * resources. It names the scene graph it has rendered.
 */
export function ScreenshotBridge() {
  const registerScreenshotHandler = useOptionalViewportActions()?.registerScreenshotHandler;
  const renderedScene = useOptionalHierarchy()?.sceneGraph ?? null;
  const gl = useThree((s) => s.gl);
  const advance = useThree((s) => s.advance);
  const getState = useThree((s) => s.get);

  useEffect(() => {
    if (!registerScreenshotHandler) return undefined;
    return registerScreenshotHandler(() => {
      advance(frameTimestamp(getState()));
      return gl.domElement.toDataURL('image/png');
    }, renderedScene);
  }, [registerScreenshotHandler, gl, advance, getState, renderedScene]);

  return null;
}
