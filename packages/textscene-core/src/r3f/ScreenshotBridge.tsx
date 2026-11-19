import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { useOptionalViewportActions } from './contexts/ViewportActionsContext.js';
import { useOptionalHierarchy } from './contexts/HierarchyContext.js';
import { drawCanvasFrame } from './drawCanvasFrame.js';

/** After the scene's contents, so its effect runs after theirs have asked for their resources. */
export function ScreenshotBridge() {
  const registerScreenshotHandler = useOptionalViewportActions()?.registerScreenshotHandler;
  const renderedScene = useOptionalHierarchy()?.sceneGraph ?? null;
  const gl = useThree((s) => s.gl);
  const getState = useThree((s) => s.get);

  useEffect(() => {
    if (!registerScreenshotHandler) return undefined;
    return registerScreenshotHandler(() => {
      drawCanvasFrame(getState());
      return gl.domElement.toDataURL('image/png');
    }, renderedScene);
  }, [registerScreenshotHandler, gl, getState, renderedScene]);

  return null;
}
