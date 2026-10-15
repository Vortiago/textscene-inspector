/**
 * Whether the compositor's tone pass mounts for one environment, and whether it carries glow.
 * Glow, blending and the adjustments all run in that pass, so it owns the tone curve when any is live.
 */

import { glowParamsFor, type GlowParams } from '../../resources/environment/godotGlow';
import type { EnvironmentSettings } from '../../resources/environment/types';

export interface CompositorPass {
  /** Null when the environment has no glow. */
  glow: GlowParams | null;
}

/**
 * Null when nothing needs the pass. Glow mounts whenever the environment enables it, as Godot runs
 * the glow chain on that flag alone (`renderer_scene_render_rd.cpp:575`, `:686`) and its bright pass
 * picks the pixels, a lit specular highlight as much as an emissive surface.
 */
export function compositorPassFor(
  settings: EnvironmentSettings,
  hasBlendedSurface: boolean
): CompositorPass | null {
  const glow = glowParamsFor(settings);
  return glow || hasBlendedSurface || settings.adjustments ? { glow } : null;
}
