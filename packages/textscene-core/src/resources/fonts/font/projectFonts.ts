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

/** The files a resolve found uncached, which the caller requests. */
export interface PendingProjectFonts {
  themes: Set<string>;
  fonts: Set<string>;
}

/** The two files the project settings name, for a caller that loads them. Null names no file. */
export interface ProjectFontPaths {
  theme: string | null;
  font: string | null;
}

export function projectFontPaths(settings: ProjectSettings | null): ProjectFontPaths {
  return { theme: projectThemePath(settings), font: projectFontPath(settings) };
}

/** Owns the failed-load warnings: the lookup runs on every solve pass, and the failure belongs to the file. */
const FAILED_FONT_LOADS = {};

/** The cached value of `path`, or null while it loads (`pending` takes the path) and after it failed. */
function cachedOrPending<T>(path: string, cache: CacheSource<T>, pending: Set<string>): T | null | undefined {
  const cached = cache.getCached(path);
  if (cached === undefined) pending.add(path);
  return cached;
}

/**
 * The font `gui/theme/custom_font` names. A failed load warns once and answers null, so the caller
 * draws the bundled font, as `ThemeDB::initialize_theme` keeps it (`theme_db.cpp:78-79`).
 */
function resolveDefaultFont(
  path: string,
  fonts: CacheSource<FontResource>,
  pending: Set<string>
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
 * in `pending`, which the caller requests. A theme that failed to load is null, as the default theme
 * then answers every lookup.
 *
 * @canonical The project theme and project default font, from the project settings and the caches
 */
export function resolveProjectFonts(
  settings: ProjectSettings | null,
  { themes, fonts }: ProjectFontCaches,
  pending: PendingProjectFonts
): ProjectFonts {
  const paths = projectFontPaths(settings);
  return {
    projectTheme: paths.theme ? (cachedOrPending(paths.theme, themes, pending.themes) ?? null) : null,
    projectDefaultFont: paths.font ? resolveDefaultFont(paths.font, fonts, pending.fonts) : null,
  };
}
