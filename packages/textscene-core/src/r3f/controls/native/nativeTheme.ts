/** The scaled default-theme metrics the native Control solver and painters read, built once per project scale. */

import { scaledGodotTheme, type ScaledGodotTheme } from '../../../godot/scene/theme';

/** The default theme's scaled metrics, by project scale. Its theme items live in the default theme table. */
export type NativeTheme = ScaledGodotTheme;

/**
 * Written only by `nativeTheme`, never cleared. Keyed, not one entry: two open previews of
 * projects with different scales would otherwise rebuild the theme and miss each per-theme memo.
 */
const themesByScale = new Map<number, NativeTheme>();

/** `NativeTheme` at a project's `gui/theme/default_theme_scale`, built once per scale: a walker per scene tile asks for the same one. */
export function nativeTheme(scale: number): NativeTheme {
  let theme = themesByScale.get(scale);
  if (!theme) {
    theme = scaledGodotTheme(scale);
    themesByScale.set(scale, theme);
  }
  return theme;
}
