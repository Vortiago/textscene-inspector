/**
 * Hands the active canvas's renderer to `ViewportActionsContext`, so the toolbar's Screenshot and
 * the host's capture read the scene that view renders, 3D or 2D. The 2D stage's DOM chrome is no
 * part of it. It renders and reads back in one task: WebGL clears the buffer only when the browser
 * composites, and `preserveDrawingBuffer` would copy the buffer every frame.
 */

import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { useOptionalViewportActions } from './contexts/ViewportActionsContext.js';
import { useOptionalHierarchy } from './contexts/HierarchyContext.js';

/**
 * Mount it after the scene's contents, so its effect runs after theirs have asked for their
 * resources. It names the scene graph it has rendered.
 */
export function ScreenshotBridge() {
  const registerScreenshotHandler = useOptionalViewportActions()?.registerScreenshotHandler;
  const renderedScene = useOptionalHierarchy()?.sceneGraph ?? null;
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    if (!registerScreenshotHandler) return undefined;
    return registerScreenshotHandler(() => {
      gl.render(scene, camera);
      return gl.domElement.toDataURL('image/png');
    }, renderedScene);
  }, [registerScreenshotHandler, gl, scene, camera, renderedScene]);

  return null;
}
