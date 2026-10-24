/**
 * The 2D-world layer of the Canvas2DStage (ADR-0006): a transparent orthographic
 * canvas that draws the CanvasItem world and the native Control canvas in one
 * view, as Godot's 2D editor does.
 */

import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { installShaderPatches } from '../../shaderPatch/installShaderPatches.js';
import { CanvasServices } from '../../CanvasServices.js';
import { World2DContents, type World2DCanvasProps } from './World2DContents.js';
import { World2DCamera } from './world2DCamera.js';

export function World2DCanvas(props: World2DCanvasProps) {
  // One instance for the canvas's life: R3F replaces its camera when the prop changes.
  const [camera] = useState(() => new World2DCamera());
  return (
    <Canvas
      camera={camera}
      // Without `localClippingEnabled`, three ignores ScrollContainer's clip planes
      // (`r3f/controls/native/controlClipping.tsx`). This canvas has no stencil buffer.
      // `antialias: false`: scene/main/viewport.h:309 `msaa_2d = MSAA_DISABLED`. Soft edges are
      // authored geometry (style_box_flat.cpp:555-629), and MSAA ramps them twice. A project that
      // turns `msaa_2d` on gets `<CanvasFrameRender>`'s target, at the mode's own sample count.
      gl={{ alpha: true, localClippingEnabled: true, antialias: false }}
      onCreated={installShaderPatches}
      // Godot composites canvas items after `_render_buffers_post_process_and_tonemap`,
      // so 2D colour is never tone-mapped. `flat` is `NoToneMapping`, not R3F's ACES.
      // It also covers a container's 3D sub-viewport pass, whose parent viewport
      // here has no Environment and so no curve.
      flat
      // Transparent to pointer input, so the stage's pan and zoom handlers work.
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <CanvasServices />
      <World2DContents {...props} />
    </Canvas>
  );
}
