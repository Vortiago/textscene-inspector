/**
 * The default theme's metrics at the active project's
 * `gui/theme/default_theme_scale` — the one hook every Control reads instead of
 * importing the raw `scale = 1` constants.
 *
 * Separate from `godotDefaultTheme.ts` so that module stays framework-free
 * (plain strings/numbers, no React), which is what lets `.ts`-only consumers and
 * the linter bundle keep reading the constants.
 */

import { useMemo } from 'react';
import { useProjectSettings } from '../contexts/ProjectSettingsContext.js';
import { scaledGodotTheme, type ScaledGodotTheme } from './godotDefaultTheme.js';

/**
 * Scaled theme metrics for the active scene. Without a
 * `<ProjectSettingsProvider>` the scale is 1.0 and every value equals the
 * corresponding `godotDefaultTheme` constant.
 */
export function useGodotTheme(): ScaledGodotTheme {
  const { themeScale } = useProjectSettings();
  return useMemo(() => scaledGodotTheme(themeScale), [themeScale]);
}
