/**
 * The project's default font: the file `gui/theme/custom_font` names. Godot makes it the fallback font
 * and the default theme's `default_font`, so it is the last rung of the Control font lookup
 * (`resolveThemeFontIn`).
 */
import { warnOnce } from '../../../utils/warnOnce';
import type { ProjectSettings } from '../../../parser/projectSettingsParser';
import type { FontCacheReader, FontResource } from './types';

/** `ThemeDB::initialize_theme` declares it (`scene/theme/theme_db.cpp:53`). */
const CUSTOM_FONT_SETTING = 'gui/theme/custom_font';

/** Owns the failed-load warnings: the lookup runs on every solve pass, and the failure belongs to the file. */
const FAILED_LOADS = {};

/**
 * The font `gui/theme/custom_font` names, or null: unset, still loading or failed. A font still loading
 * lands in `pending`, which the caller requests. A failed load warns once and answers null, so the
 * caller draws the bundled font, as `ThemeDB::initialize_theme` keeps it (`theme_db.cpp:78-79`).
 */
export function resolveProjectDefaultFont(
  settings: ProjectSettings | null,
  fontCache: FontCacheReader,
  pending: Set<string>
): FontResource | null {
  const path = settings?.[CUSTOM_FONT_SETTING]?.trim();
  if (!path) return null;

  const cached = fontCache.getCached(path);
  if (cached === undefined) {
    pending.add(path);
    return null;
  }
  if (cached === null) {
    warnOnce(
      FAILED_LOADS,
      path,
      `[ProjectFont] ${CUSTOM_FONT_SETTING} names "${path}", which failed to load. Drawing the bundled default font.`
    );
  }
  return cached;
}
