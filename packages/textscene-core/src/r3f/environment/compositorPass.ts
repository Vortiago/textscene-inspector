/**
 * Whether the compositor's tone pass mounts for one environment, whether it carries glow, and how
 * many samples its scene buffer takes. Glow, blending, the adjustments and MSAA all run in that
 * pass, so it owns the tone curve when any is live.
 */

import * as THREE from 'three';
import { glowParamsFor, type GlowParams } from '../../resources/environment/godotGlow';
import type { EnvironmentSettings } from '../../resources/environment/types';
import type { TargetTexture } from '../multisampledTarget';

/** The scene buffer's texture: half float, which postprocessing builds at the composer's `frameBufferType`. */
export const SCENE_BUFFER: TargetTexture = {
  type: THREE.HalfFloatType,
  colorSpace: THREE.NoColorSpace,
  internalFormat: null,
};

export interface CompositorPass {
  /** Null when the environment has no glow. */
  glow: GlowParams | null;
  /** The scene buffer's samples per pixel, 0 for one buffer that does not multisample. */
  samples: number;
}

/**
 * Null when nothing needs the pass. A null `settings` is a root with no Environment, which still
 * multisamples and blends in the HDR buffer, with no glow and no adjustments. Glow mounts whenever
 * the environment enables it, as Godot runs the glow chain on that flag alone
 * (`renderer_scene_render_rd.cpp:575`, `:686`) and its bright pass picks the pixels, a lit specular
 * highlight as much as an emissive surface. MSAA mounts it too: Godot resolves the multisampled 3D
 * buffer in linear HDR (`render_forward_clustered.cpp:2402`), before the tonemap pass reads it
 * (`:2514`).
 */
export function compositorPassFor(
  settings: EnvironmentSettings | null,
  hasBlendedSurface: boolean,
  msaa3DSamples: number
): CompositorPass | null {
  const glow = settings && glowParamsFor(settings);
  const needed = glow || hasBlendedSurface || settings?.adjustments || msaa3DSamples > 0;
  return needed ? { glow, samples: msaa3DSamples } : null;
}
