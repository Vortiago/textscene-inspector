/** Godot 4.6.3's Environment glow settings, as a scene file writes them. */

/** `Environment.GlowBlendMode` (`scene/resources/environment.h:83-88`). */
export const GlowBlendMode = {
  ADDITIVE: 0,
  SCREEN: 1,
  SOFTLIGHT: 2,
  REPLACE: 3,
  MIX: 4,
} as const;

/** The blend a scene stores no `glow_blend_mode` for (`scene/resources/environment.h:172`). */
export const GLOW_BLEND_MODE_DEFAULT = GlowBlendMode.SCREEN;
