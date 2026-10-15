/**
 * Whether the compositor's tone pass mounts for one environment, whether it carries glow, and how
 * many samples its scene buffer takes. Glow, blending, the adjustments and MSAA all run in that
 * pass, so it owns the tone curve when any is live.
 */

import { glowParamsFor, type GlowParams } from '../../resources/environment/godotGlow';
import type { EnvironmentSettings } from '../../resources/environment/types';

export interface CompositorPass {
  /** Null when the environment has no glow. */
  glow: GlowParams | null;
  /** The scene buffer's samples per pixel, 0 for one buffer that does not multisample. */
  samples: number;
}

/**
 * Null when nothing needs the pass. A null `settings` is a root with no Environment. Glow mounts on
 * the environment's flag alone, as Godot runs its chain on that flag (`renderer_scene_render_rd.cpp:575`,
 * `:686`), and MSAA mounts the pass so the buffer resolves in linear HDR (ADR-0052).
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
