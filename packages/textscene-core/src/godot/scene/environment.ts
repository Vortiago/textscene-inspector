/** Godot 4.6.3's Environment resource: its class defaults and what its setters store. */

import { FogMode } from '../rendering/environment/depthFog.js';
import { GlowBlendMode } from '../rendering/environment/glow.js';

/**
 * The density a scene stores no `fog_density` for. `set_fog_mode` runs before the density on load
 * and sets 1 for any mode but a change to exponential (`scene/resources/environment.cpp:778-784`),
 * so a depth fog's density starts at 1.
 */
export function depthFogDensityDefault(mode: number): number {
  return mode === FogMode.DEPTH ? 1 : 0.01;
}

/** `fog_depth_begin` and `fog_depth_end`'s defaults (`scene/resources/environment.h:196-197`). */
const DEPTH_BEGIN_DEFAULT = 10;
const DEPTH_END_DEFAULT = 100;

/**
 * The range the setters store. Each setter drags the other end along so the begin never passes the
 * end, and the begin loads first (`scene/resources/environment.cpp:879-896`).
 */
export function depthFogRange(authored: { begin?: number; end?: number }): { begin: number; end: number } {
  let begin = DEPTH_BEGIN_DEFAULT;
  let end = DEPTH_END_DEFAULT;
  if (authored.begin !== undefined) {
    begin = authored.begin;
    if (begin > end) end = begin;
  }
  if (authored.end !== undefined) {
    end = authored.end;
    if (end < begin) begin = end;
  }
  return { begin, end };
}

/** The blend a scene stores no `glow_blend_mode` for (`scene/resources/environment.h:172`). */
export const GLOW_BLEND_MODE_DEFAULT = GlowBlendMode.SCREEN;
