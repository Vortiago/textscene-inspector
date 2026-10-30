/**
 * The root canvas's tonemap pass (`toneMapPass.ts`): Godot tonemaps the finished colour buffer after
 * the alpha pass (`render_forward_clustered.cpp:2514`, `:2389`), never per fragment. It draws the
 * canvas's scene into the world buffer, then tonemaps that buffer onto the canvas.
 */

import { useFrame, useThree } from '@react-three/fiber';
import { projectTransparentBackground, projectUsesDebanding } from '../../parser/projectSettingsParser';
import { useProjectSettings } from '../contexts/ProjectSettingsContext';
import { SubscriberStep } from '../frameProfile/FrameProfiler';
import { useToneMapPass } from './toneMapPass';

/** The pass's `useFrame` priority. A positive one takes the canvas's render over from R3F. */
const COMPOSITOR_PRIORITY = 1;

/** Tonemaps the root world onto the canvas, which is the root window's surface. */
export function Compositor() {
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
    toneMap.drawWorld(scene, camera);
    toneMap.toneMap();
  }, COMPOSITOR_PRIORITY);
  return <SubscriberStep step="Compositor" priority={COMPOSITOR_PRIORITY} />;
}

/** The canvas's size in device pixels, floored as three floors its drawing buffer (`WebGLRenderer.js:711`). */
function useDrawingBufferSize(): { width: number; height: number } {
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);
  return { width: Math.floor(size.width * dpr), height: Math.floor(size.height * dpr) };
}
