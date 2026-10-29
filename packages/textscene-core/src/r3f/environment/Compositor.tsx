/**
 * The root canvas's tonemap pass (`toneMapPass.ts`): Godot tonemaps the finished colour buffer after
 * the alpha pass (`render_forward_clustered.cpp:2514`, `:2389`), never per fragment. It draws the
 * canvas's scene into the world buffer, then tonemaps that buffer onto the canvas.
 */

import { useMemo } from 'react';
import type * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { projectTransparentBackground, projectUsesDebanding } from '../../parser/projectSettingsParser';
import { useProjectSettings } from '../contexts/ProjectSettingsContext';
import { SubscriberStep } from '../frameProfile/FrameProfiler';
import { useToneMapPass } from './toneMapPass';

/** The pass's `useFrame` priority. A positive one takes the canvas's render over from R3F. */
const COMPOSITOR_PRIORITY = 1;

/** Tonemaps the root world onto the canvas, which is the root window's surface. */
export function Compositor() {
  const gl = useThree((state) => state.gl);
  const { width, height } = useDrawingBufferSize();
  const project = useProjectSettings();
  const toneMap = useToneMapPass({
    target: null,
    msaaMode: project.msaaModes.msaa3D,
    width,
    height,
    transparentBackground: projectTransparentBackground(project.settings),
    usesDebanding: projectUsesDebanding(project.settings),
    name: 'Canvas',
  });
  useFrame(({ scene, camera }) => {
    drawWorld(gl, toneMap.worldBuffer, () => gl.render(scene, camera));
    toneMap.toneMap();
  }, COMPOSITOR_PRIORITY);
  return <SubscriberStep step="Compositor" priority={COMPOSITOR_PRIORITY} />;
}

/**
 * Runs `render` into `worldBuffer` with `autoClear` on, then binds the canvas again. The render clears
 * the buffer itself: three applies the clear colour in the bound target's colour space only there
 * (`WebGLBackground.js:53`), and a clear before it would write the canvas's sRGB value.
 */
function drawWorld(gl: THREE.WebGLRenderer, worldBuffer: THREE.WebGLRenderTarget, render: () => void): void {
  const autoClear = gl.autoClear;
  gl.autoClear = true;
  gl.setRenderTarget(worldBuffer);
  try {
    render();
  } finally {
    gl.setRenderTarget(null);
    gl.autoClear = autoClear;
  }
}

/** The canvas's size in device pixels, floored as three floors its drawing buffer (`WebGLRenderer.js:711`). */
function useDrawingBufferSize(): { width: number; height: number } {
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);
  return useMemo(
    () => ({ width: Math.floor(size.width * dpr), height: Math.floor(size.height * dpr) }),
    [size, dpr]
  );
}
