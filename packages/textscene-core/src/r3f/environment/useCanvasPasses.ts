/**
 * The passes one environment draws on the canvas: whether the 3D passes run at all, and the
 * compositor's tone pass with its glow and samples. The 3D passes need a real GL context, so a 2D
 * canvas, test-renderer and a headless DOM get none.
 */

import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import type { EnvironmentSettings } from '../../resources/environment/types';
import { useCanvasWorkspace } from '../contexts/CanvasWorkspaceContext';
import { useProjectSettings } from '../contexts/ProjectSettingsContext';
import { useDeviceSampleCount } from '../deviceSampleCount';
import { sceneHasBlendedSurface } from './alphaPassScan';
import { useLatchedSceneScan } from './useLatchedSceneScan';
import { compositorPassFor, type CompositorPass } from './compositorPass';
import { useWorldKind } from './WorldKindContext';

export interface CanvasPasses {
  /**
   * Whether the tone-map compositor and the volumetric fog can draw. Godot composites canvas items
   * after `_render_buffers_post_process_and_tonemap`, so a 2D canvas gets neither, and every canvas
   * item there blends.
   */
  draws3D: boolean;
  /** Null when nothing needs the pass, and in a sub-viewport's world, whose pass draws no compositor. */
  compositor: CompositorPass | null;
}

/** A null `settings` is a root with no Environment. */
export function useCanvasPasses(settings: EnvironmentSettings | null): CanvasPasses {
  const hasBlended = useLatchedSceneScan(sceneHasBlendedSurface);
  const draws3D = useDraws3D();
  const isRootWorld = useWorldKind() === 'root';
  // The root viewport's samples: the compositor draws only the root's world. The composer's scene
  // buffer is half float (`EffectComposer`'s `frameBufferType`).
  const msaa3D = useDeviceSampleCount(useProjectSettings().msaaSamples.msaa3D, 'RGBA16F');
  // Memoised, since a new glow object rebuilds the compositor's effect.
  return useMemo(
    () => ({
      draws3D,
      compositor: draws3D && isRootWorld ? compositorPassFor(settings, hasBlended, msaa3D) : null,
    }),
    [draws3D, isRootWorld, settings, hasBlended, msaa3D]
  );
}

function useDraws3D(): boolean {
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
