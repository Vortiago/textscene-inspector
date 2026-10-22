/** Godot 4.6.3's Environment resource: its enums with their label tables, class defaults and what its setters store. */

import { enumNamesByValue } from '../classdb/enumNames.js';
import { FogMode } from '../rendering/environment/depthFog.js';
import { GlowBlendMode } from '../rendering/environment/glow.js';

/** `Environment::BGMode` without `BG_MAX` (`scene/resources/environment.h:41-48`, 4.7.2 `:42-49`). */
export const BackgroundMode = {
  BG_CLEAR_COLOR: 0,
  BG_COLOR: 1,
  BG_SKY: 2,
  BG_CANVAS: 3,
  BG_KEEP: 4,
  BG_CAMERA_FEED: 5,
} as const;

/** `Environment::AmbientSource` without `AMBIENT_SOURCE_` (`environment.h:51-56`, 4.7.2 `:52-57`). */
export const AmbientSource = {
  BG: 0,
  DISABLED: 1,
  COLOR: 2,
  SKY: 3,
} as const;

/** `Environment::ReflectionSource` without `REFLECTION_SOURCE_` (`environment.h:58-62`, 4.7.2 `:59-63`). */
const ReflectionSource = {
  BG: 0,
  DISABLED: 1,
  SKY: 2,
} as const;

/** `Environment::SDFGIYScale` without `SDFGI_` (`environment.h:72-76`, 4.7.2 `:73-77`). */
const SdfgiYScale = {
  Y_SCALE_50_PERCENT: 0,
  Y_SCALE_75_PERCENT: 1,
  Y_SCALE_100_PERCENT: 2,
} as const;

export const BACKGROUND_MODE_NAMES = enumNamesByValue(BackgroundMode);
export const AMBIENT_SOURCE_NAMES = enumNamesByValue(AmbientSource);
export const REFLECTION_SOURCE_NAMES = enumNamesByValue(ReflectionSource);
export const SDFGI_Y_SCALE_NAMES = enumNamesByValue(SdfgiYScale);

/** Each `Environment::FogMode` by its integer, without `FOG_MODE_` (`environment.h:78-81`, 4.7.2 `:79-82`). */
export const FOG_MODE_NAMES = enumNamesByValue(FogMode);

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
