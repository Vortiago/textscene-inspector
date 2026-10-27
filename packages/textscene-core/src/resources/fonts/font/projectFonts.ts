/**
 * The project font context: the project theme (`gui/theme/custom`) and the project default font
 * (`gui/theme/custom_font`). A font lookup reaches them after the font of the node itself. Godot
 * loads both once, in `ThemeDB::initialize_theme` (`scene/theme/theme_db.cpp:53-80`): the theme joins the
 * default theme context, and the font becomes the fallback font and the default theme's `default_font`.
 */
import { warnOnce } from '../../../utils/warnOnce';
import {
  projectFontPath,
  projectThemePath,
  type ProjectSettings,
} from '../../../parser/projectSettingsParser';
import type { CacheSource } from '../../../r3f/cacheSources';
import type { ThemeResource } from '../../styles/theme/types';
import type { FontResource } from './types';

export interface ProjectFonts {
  /** Null for no theme, one still loading and one that failed. */
  readonly projectTheme: ThemeResource | null;
  /** Null draws the bundled font. */
  readonly projectDefaultFont: FontResource | null;
}

export const NO_PROJECT_FONTS: ProjectFonts = { projectTheme: null, projectDefaultFont: null };

export interface ProjectFontCaches {
  themes: CacheSource<ThemeResource>;
  fonts: CacheSource<FontResource>;
}

/** The files a resolve found uncached, which a caller that loads them requests. */
export interface PendingProjectFonts {
  themes: Set<string>;
  fonts: Set<string>;
}

/** Owns the failed-load warnings: the lookup runs on every solve pass, and the failure belongs to the file. */
const FAILED_FONT_LOADS = {};

/** The cached value of `path`, or null while it loads (`pending` takes the path) and after it failed. */
function cachedOrPending<T>(
  path: string,
  cache: CacheSource<T>,
  pending: Set<string> | undefined
): T | null | undefined {
  const cached = cache.getCached(path);
  if (cached === undefined) pending?.add(path);
  return cached;
}

/**
 * The font `gui/theme/custom_font` names. A failed load warns once and answers null, so the caller
 * draws the bundled font, as `ThemeDB::initialize_theme` keeps it (`theme_db.cpp:78-79`).
 */
function resolveDefaultFont(
  path: string,
  fonts: CacheSource<FontResource>,
  pending: Set<string> | undefined
): FontResource | null {
  const font = cachedOrPending(path, fonts, pending);
  if (font === null) {
    warnOnce(
      FAILED_FONT_LOADS,
      path,
      `[ProjectFont] gui/theme/custom_font names "${path}", which failed to load. Drawing the bundled default font.`
    );
  }
  return font ?? null;
}

/**
 * The project font context from `settings`, as the caches hold it now. A file still loading lands
 * in `pending`, when a caller passes it to request them. A theme that failed to load is null, as the default theme
 * then answers every lookup.
 *
 * @canonical The project theme and project default font, from the project settings and the caches
 */
export function resolveProjectFonts(
  settings: ProjectSettings | null,
  { themes, fonts }: ProjectFontCaches,
  pending?: PendingProjectFonts
): ProjectFonts {
  const themePath = projectThemePath(settings);
  const fontPath = projectFontPath(settings);
  return {
    projectTheme: themePath ? (cachedOrPending(themePath, themes, pending?.themes) ?? null) : null,
    projectDefaultFont: fontPath ? resolveDefaultFont(fontPath, fonts, pending?.fonts) : null,
  };
}
