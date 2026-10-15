/**
 * The 2D-world layer of the Canvas2DStage (ADR-0006): a transparent orthographic
 * canvas that draws the CanvasItem world and the native Control canvas in one
 * view, as Godot's 2D editor does.
 */

import { Canvas } from '@react-three/fiber';
import { installShaderPatches } from '../../shaderPatch/installShaderPatches.js';
import { World2DContents, type World2DCanvasProps } from './World2DContents.js';

export function World2DCanvas(props: World2DCanvasProps) {
  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 1000], near: 0.1, far: 4000 }}
      // Without `localClippingEnabled`, three ignores ScrollContainer's clip planes
      // (`r3f/controls/native/controlClipping.tsx`). This canvas has no stencil buffer.
      // `antialias: false`: scene/main/viewport.h:309 `msaa_2d = MSAA_DISABLED`.
      // Soft edges are authored geometry (style_box_flat.cpp:555-629), and MSAA ramps them twice.
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
      <World2DContents {...props} />
    </Canvas>
  );
}
