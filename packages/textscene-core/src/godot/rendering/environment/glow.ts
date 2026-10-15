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

/** Each blend mode's name by the integer a `.tscn` stores, as a validator names it. */
export const GLOW_BLEND_MODE_NAMES = enumNamesByValue(GlowBlendMode);

/** The blend a scene stores no `glow_blend_mode` for (`scene/resources/environment.h:172`). */
export const GLOW_BLEND_MODE_DEFAULT = GlowBlendMode.SCREEN;
