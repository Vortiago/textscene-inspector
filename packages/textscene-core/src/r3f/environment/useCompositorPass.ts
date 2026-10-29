/**
 * The compositor's tone pass for one 3D canvas: with what glow, how many samples, which auto exposure
 * and whether it dithers. The pass owns the tone curve of every 3D frame. It needs a real 3D GL
 * context, so a 2D canvas, test-renderer and a headless DOM get none.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { glowParamsFor, type GlowParams } from '../../resources/environment/godotGlow';
import type { EnvironmentSettings } from '../../resources/environment/types';
import type { AutoExposure } from '../../resources/cameraattributes/types';
import { useAutoExposure } from './worldExposure';
import { useCanvasWorkspace } from '../contexts/CanvasWorkspaceContext';
import { useProjectSettings } from '../contexts/ProjectSettingsContext';
import { projectUsesDebanding } from '../../parser/projectSettingsParser';
import { useSampleCount } from '../multisampledTarget';

/**
 * The scene buffer's texel type, which postprocessing builds at the composer's `frameBufferType`.
 * Godot's colour buffer is RGBA16F (`renderer_scene_render_rd.cpp:1128`), and its rounding shows.
 */
export const SCENE_BUFFER_TYPE = THREE.HalfFloatType;

export interface CompositorPass {
  /** Null when the environment has no glow. */
  glow: GlowParams | null;
  /** The scene buffer's samples per pixel, 0 for one buffer that does not multisample. */
  samples: number;
  /** Null when the camera attributes hold no auto exposure. */
  autoExposure: AutoExposure | null;
  /** The project's `use_debanding`, which the root viewport takes. */
  usesDebanding: boolean;
}

/**
 * Null when the canvas draws no 3D. Godot draws every 3D frame into a half-float buffer
 * (`renderer_scene_render_rd.cpp:1128`) and tonemaps it in a pass (`render_forward_clustered.cpp:2514`),
 * so the pass mounts whatever the scene draws, and a blended surface or a value that rounds in that
 * buffer reads the same either way (#1081). A null `settings` is a root with no Environment. Glow
 * runs on the environment's flag alone, as Godot's glow chain runs (`renderer_scene_render_rd.cpp:575`, `:686`).
 */
export function useCompositorPass(settings: EnvironmentSettings | null): CompositorPass | null {
  const autoExposure = useAutoExposure();
  const draws3D = useDraws3D();
  const project = useProjectSettings();
  const msaa3D = useSampleCount(project.msaaModes.msaa3D, SCENE_BUFFER_TYPE);
  const usesDebanding = projectUsesDebanding(project.settings);
  // Memoised, since a new glow object rebuilds the compositor's effect.
  return useMemo(() => {
    if (!draws3D) return null;
    const glow = settings && glowParamsFor(settings);
    return { glow, samples: msaa3D, autoExposure, usesDebanding };
  }, [draws3D, settings, autoExposure, msaa3D, usesDebanding]);
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
