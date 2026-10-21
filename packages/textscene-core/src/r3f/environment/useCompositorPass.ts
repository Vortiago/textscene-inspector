/**
 * The compositor's tone pass for one canvas: whether it mounts, with what glow and how many samples.
 * Glow, blending, the adjustments and MSAA all run in that pass, so it owns the tone curve when any
 * is live. The pass needs a real 3D GL context, so a 2D canvas, test-renderer and a headless DOM get
 * none.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { glowParamsFor, type GlowParams } from '../../resources/environment/godotGlow';
import type { EnvironmentSettings } from '../../resources/environment/types';
import { useResourceLoader } from '../../resources/useResource';
import { COMMIT_FRAMES_AFTER_SETTLE } from '../../resources/ResourceLoaderContext';
import { useCanvasWorkspace } from '../contexts/CanvasWorkspaceContext';
import { useOptionalHierarchy } from '../contexts/HierarchyContext';
import { useProjectSettings } from '../contexts/ProjectSettingsContext';
import { useSampleCount } from '../multisampledTarget';
import { sceneHasBlendedSurface } from './alphaPassScan';

/** The scene buffer's texel type, which postprocessing builds at the composer's `frameBufferType`. */
export const SCENE_BUFFER_TYPE = THREE.HalfFloatType;

export interface CompositorPass {
  /** Null when the environment has no glow. */
  glow: GlowParams | null;
  /** The scene buffer's samples per pixel, 0 for one buffer that does not multisample. */
  samples: number;
}

/**
 * Null when nothing needs the pass. A null `settings` is a root with no Environment, which still
 * multisamples and blends in the HDR buffer. Glow mounts on the environment's flag alone, as Godot's glow
 * chain runs (`renderer_scene_render_rd.cpp:575`, `:686`). MSAA mounts it too: Godot resolves the 3D
 * buffer in linear HDR (`render_forward_clustered.cpp:2402`) before the tonemap pass reads it (`:2514`).
 */
export function useCompositorPass(settings: EnvironmentSettings | null): CompositorPass | null {
  const hasBlended = useBlendedSurfaceLatch();
  const draws3D = useDraws3D();
  const msaa3D = useSampleCount(useProjectSettings().msaaModes.msaa3D, SCENE_BUFFER_TYPE);
  // Memoised, since a new glow object rebuilds the compositor's effect.
  return useMemo(() => {
    if (!draws3D) return null;
    const glow = settings && glowParamsFor(settings);
    const needed = glow || hasBlended || settings?.adjustments || msaa3D > 0;
    return needed ? { glow, samples: msaa3D } : null;
  }, [draws3D, settings, hasBlended, msaa3D]);
}

/**
 * Whether the scene draws a blended surface, latched once it does: Godot blends in linear HDR and
 * tonemaps after (`render_forward_clustered.cpp:2389` then `:2514`), while three tonemaps per
 * fragment and blends two curved operands. The scan runs every frame while the scene loads and for a
 * few frames after, so loaded content counts and an overlay a later click adds does not. It latches
 * because mounting the composer flips `gl.toneMapping`, which recompiles every tone-mapped material.
 */
function useBlendedSurfaceLatch(): boolean {
  const scene = useThree((s) => s.scene);
  const loader = useResourceLoader();
  const rootKey = useOptionalHierarchy()?.sceneGraph?.rootScene ?? '';
  const [found, setFound] = useState(false);
  /** Written by the frame scan when it latches. Cleared when the scene changes. */
  const latched = useRef(false);
  /** Frames left to scan. Infinite while a load is pending, reset to the tail when it settles. */
  const framesLeft = useRef(COMMIT_FRAMES_AFTER_SETTLE);

  useEffect(() => {
    // A different scene must not inherit the previous one's latch.
    latched.current = false;
    setFound(false);
    const onPendingChange = () => {
      const pending = (loader?.pendingResourceCount ?? 0) > 0;
      framesLeft.current = pending ? Infinity : COMMIT_FRAMES_AFTER_SETTLE;
    };
    onPendingChange();
    return loader?.subscribePending(onPendingChange);
  }, [scene, rootKey, loader]);

  useFrame(() => {
    if (latched.current || framesLeft.current <= 0) return;
    framesLeft.current -= 1;
    if (!sceneHasBlendedSurface(scene)) return;
    latched.current = true;
    setFound(true);
  });

  return found;
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
