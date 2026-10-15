/**
 * The compositor's tone pass for one canvas: whether it mounts, with what glow and how many samples.
 * The pass needs a real 3D GL context, so a 2D canvas, test-renderer and a headless DOM get none.
 */

import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import type { EnvironmentSettings } from '../../resources/environment/types';
import { useCanvasWorkspace } from '../contexts/CanvasWorkspaceContext';
import { useProjectSettings } from '../contexts/ProjectSettingsContext';
import { useSampleCount } from '../multisampledTarget';
import { sceneHasBlendedSurface } from './alphaPassScan';
import { useLatchedSceneScan } from './useLatchedSceneScan';
import { compositorPassFor, SCENE_BUFFER, type CompositorPass } from './compositorPass';

/** Null when nothing needs the pass. A null `settings` is a root with no Environment. */
export function useCompositorPass(settings: EnvironmentSettings | null): CompositorPass | null {
  const hasBlended = useLatchedSceneScan(sceneHasBlendedSurface);
  const draws3D = useDraws3D();
  const msaa3D = useSampleCount(useProjectSettings().msaaModes.msaa3D, SCENE_BUFFER);
  // Memoised, since a new glow object rebuilds the compositor's effect.
  return useMemo(
    () => (draws3D ? compositorPassFor(settings, hasBlended, msaa3D) : null),
    [draws3D, settings, hasBlended, msaa3D]
  );
}

/**
 * Whether this canvas draws the 3D passes: the tone-map compositor and the volumetric fog. Both need
 * a real GL context, which test-renderer and a headless DOM lack. Godot composites canvas items
 * after `_render_buffers_post_process_and_tonemap`, so a 2D canvas gets neither, and every canvas
 * item there blends.
 */
export function useDraws3D(): boolean {
  const gl = useThree((s) => s.gl);
  const glReady = useMemo(() => hasRealGlContext(gl), [gl]);
  const is2D = useCanvasWorkspace() === '2d';
  return glReady && !is2D;
}

function hasRealGlContext(gl: { getContext?: () => unknown }): boolean {
  try {
    const ctx = gl.getContext?.() as { getContextAttributes?: () => unknown } | null;
    return !!ctx && typeof ctx.getContextAttributes === 'function' && !!ctx.getContextAttributes();
  } catch {
    // A mock renderer's `getContext` can throw, and a canvas with no context draws no 3D passes.
    return false;
  }
}
