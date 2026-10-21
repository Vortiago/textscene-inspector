/** Godot 4.6.3's Environment glow settings, as a scene file writes them. */

import { enumNamesByValue } from '../../classdb/enumNames.js';

/** `Environment.GlowBlendMode` (`scene/resources/environment.h:83-88`). */
export const GlowBlendMode = {
  ADDITIVE: 0,
  SCREEN: 1,
  SOFTLIGHT: 2,
  REPLACE: 3,
  MIX: 4,
} as const;

/**
 * `rendering/environment/glow/upscale_mode`: how the composite reads each glow level
 * (`rendering_server.cpp:3809`, whose default is Bicubic).
 */
export const GlowUpscaleMode = {
  LINEAR: 0,
  BICUBIC: 1,
} as const;

/** Each blend mode's name by the integer a `.tscn` stores, as a validator names it. */
export const GLOW_BLEND_MODE_NAMES = enumNamesByValue(GlowBlendMode);
