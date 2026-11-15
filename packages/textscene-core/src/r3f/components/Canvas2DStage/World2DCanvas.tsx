/**
 * The 2D-world layer of the Canvas2DStage (ADR-0006): a transparent orthographic
 * canvas that draws the CanvasItem world and the native Control canvas in one
 * view, as Godot's 2D editor does.
 */

import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { CANVAS_RENDERER_GL, CANVAS_RENDERER_PROPS } from '../../canvasRenderer/canvasRendererProps.js';
import { usePreviewFrameloop } from '../../contexts/PreviewVisibilityContext.js';
import { World2DContents, type World2DCanvasProps } from './World2DContents.js';
import { World2DCamera } from './world2DCamera.js';

export function World2DCanvas(props: World2DCanvasProps) {
  // One instance for the canvas's life: R3F replaces its camera when the prop changes.
  const [camera] = useState(() => new World2DCamera());
  const frameloop = usePreviewFrameloop();
  return (
    <Canvas
      {...CANVAS_RENDERER_PROPS}
      camera={camera}
      frameloop={frameloop}
      // `alpha`: the 2D world draws over the stage behind it.
      gl={{ ...CANVAS_RENDERER_GL, alpha: true }}
      // Transparent to pointer input, so the stage's pan and zoom handlers work.
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <World2DContents {...props} />
    </Canvas>
  );
}
