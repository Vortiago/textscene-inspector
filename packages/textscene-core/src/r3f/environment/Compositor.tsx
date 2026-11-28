/**
 * The root canvas's tonemap pass (`toneMapPass.ts`): Godot tonemaps the finished colour buffer after
 * the alpha pass (`render_forward_clustered.cpp:2514`, `:2389`), never per fragment. It draws the
 * canvas's scene into the world buffer, then tonemaps that buffer onto the canvas.
 */

import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useRootViewportDescription } from '../viewportRender/useRootViewportDescription';
import { drawWorld, type WorldRender } from '../viewportRender/worldRender';
import { withFrameStep } from '../frameProfile/frameProfile';
import { useViewShow } from '../viewShow/ViewShowContext';
import { useToneMapPass } from './toneMapPass';
import { useDrawingBufferSize } from '../useDrawingBufferSize';

/** The pass's `useFrame` priority. A positive one takes the canvas's render over from R3F. */
const COMPOSITOR_PRIORITY = 1;

/** Tonemaps the root world onto the canvas, which is the root window's surface. */
export function Compositor() {
  const { width, height } = useDrawingBufferSize();
  const root = useRootViewportDescription();
  const toneMap = useToneMapPass({
    target: null,
    msaaMode: root.msaa3D,
    width,
    height,
    transparentBackground: root.transparentBackground,
    usesDebanding: root.usesDebanding,
    name: 'Canvas',
  });
  const render = useMemo<WorldRender>(
    () => ({ viewport: root, shadowAtlas: null, canvasView: null }),
    [root]
  );
  const isTimed = useViewShow().performance;
  useFrame(({ gl, scene, camera }) => {
    withFrameStep(gl, isTimed ? 'Compositor' : null, () => {
      drawWorld(render, () => toneMap.drawWorld(scene, camera));
      toneMap.toneMap();
    });
  }, COMPOSITOR_PRIORITY);
  return null;
}
