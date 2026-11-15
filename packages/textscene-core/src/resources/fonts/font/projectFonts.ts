/**
 * The project font context: the project theme (`gui/theme/custom`), the project default font
 * (`gui/theme/custom_font`) and the default theme at the project's scale. A theme lookup reaches them
 * after the node and its ancestors. Godot loads the theme and the font once, in
 * `ThemeDB::initialize_theme` (`scene/theme/theme_db.cpp:53-80`): the theme joins the default theme
 * context, and the font becomes the fallback font and the default theme's `default_font`.
 */
import { warnOnce } from '../../../utils/warnOnce';
import {
  projectFontPath,
  projectThemePath,
  projectThemeScale,
  type ProjectSettings,
} from '../../../parser/projectSettingsParser';
import { defaultThemeAt, type DefaultTheme } from '../../../godot/scene/defaultTheme/defaultTheme';
import type { CacheSource } from '../../../r3f/cacheSources';
import type { ThemeResource } from '../../styles/theme/types';
import type { FontResource } from './types';
import { perObject } from '../../../utils/perObject';
import { FONT_FILES } from '../../fileKinds';
import type { Read, ResourceSnapshot } from '../../reading/read';

export interface ProjectFonts {
  /** Null for no theme, one still loading and one that failed. */
  readonly projectTheme: ThemeResource | null;
  /** Null draws the bundled font. */
  readonly projectDefaultFont: FontResource | null;
  /**
   * The default theme at `gui/theme/default_theme_scale`, which `ThemeDB::initialize_theme` builds where
   * it loads the project theme and font (`theme_db.cpp:50-86`).
   */
  readonly defaultTheme: DefaultTheme;
}

export const NO_PROJECT_FONTS: ProjectFonts = {
  projectTheme: null,
  projectDefaultFont: null,
  defaultTheme: defaultThemeAt(1),
};

export interface ProjectFontCaches {
  themes: CacheSource<ThemeResource>;
  fonts: CacheSource<FontResource>;
}

/** The project theme's own copy of a loaded theme, which a scene may also hold. */
const outsideScenes = perObject((theme: ThemeResource): ThemeResource => ({
  ...theme,
  isOutsideScenes: true,
}));

/** Owns the failed-load warnings: the lookup runs on every solve pass, and the failure belongs to the file. */
const FAILED_FONT_LOADS = {};

/** The cached value of `path`: undefined while it loads (`pending` takes the path), null after it failed. */
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
function resolveDefaultFont(path: string, fonts: CacheSource<FontResource>): FontResource | null {
  const font = fonts.getCached(path);
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
 * The project font context from `settings`, as the caches hold it now. A theme still loading lands
 * in `pendingThemes`, when a caller passes it to request them; a caller records its font reads in
 * `fonts`. A theme that failed to load is null, as the default theme then answers every lookup.
 *
 * @canonical The project theme and project default font, from the project settings and the caches
 */
export function resolveProjectFonts(
  settings: ProjectSettings | null,
  { themes, fonts }: ProjectFontCaches,
  pendingThemes?: Set<string>
): ProjectFonts {
  const themePath = projectThemePath(settings);
  const fontPath = projectFontPath(settings);
  return {
    projectTheme: themePath ? projectThemeOf(cachedOrPending(themePath, themes, pendingThemes)) : null,
    projectDefaultFont: fontPath ? resolveDefaultFont(fontPath, fonts) : null,
    defaultTheme: defaultThemeAt(projectThemeScale(settings)),
  };
}

function projectThemeOf(theme: ThemeResource | null | undefined): ThemeResource | null {
  return theme ? outsideScenes(theme) : null;
}

/**
 * The font files `snapshot` holds, as a cache: the solve reads its project default font there, so
 * the snapshot records the read and its host requests the file.
 */
export function fontFilesOn(snapshot: ResourceSnapshot): CacheSource<FontResource> {
  return { getCached: (path) => cachedFileOf(snapshot.loaded(FONT_FILES, path)) };
}

function cachedFileOf<T>(read: Read<T>): T | null | undefined {
  if (read.status === 'pending') return undefined;
  return read.value;
}
