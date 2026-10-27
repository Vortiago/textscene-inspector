/**
 * The project font context as a hook: loads the theme and the font that `project.godot` names, for
 * a reader outside the Control solve tree, such as a TextMesh. The solve tree resolves the same
 * context through `resolveProjectFonts` in its own walk.
 */

import { useCallback, useMemo } from 'react';
import type { CacheSource } from '../r3f/cacheSources';
import { useProjectSettings } from '../r3f/contexts/ProjectSettingsContext';
import { projectFontPath, projectThemePath } from '../parser/projectSettingsParser';
import { resolveProjectFonts, NO_PROJECT_FONTS, type ProjectFonts } from './fonts/font/projectFonts';
import { FONT_FILES, THEME_FILES, useCachedFiles } from './useLoadedFiles';

export interface LoadedProjectFonts {
  projectFonts: ProjectFonts;
  /** True while the theme or the font has neither loaded nor failed. */
  isLoading: boolean;
}

/** Tells a failed load (null) from a pending one (undefined): the loaded-file reader answers undefined for both. */
function settledSource<T>(loadedFile: (path: string) => T | undefined, isLoading: boolean): CacheSource<T> {
  return { getCached: (path) => loadedFile(path) ?? (isLoading ? undefined : null) };
}

/**
 * A caller that reads no project font passes `isNeeded` false: the hook then loads nothing and
 * listens to no bus.
 *
 * @canonical The project theme and project default font, for a node outside the Control solve tree
 */
export function useProjectFonts(isNeeded: boolean): LoadedProjectFonts {
  const { settings } = useProjectSettings();
  const themePath = projectThemePath(settings);
  const fontPath = projectFontPath(settings);
  const themePlan = useCallback(() => (themePath ? [themePath] : []), [themePath]);
  const fontPlan = useCallback(() => (fontPath ? [fontPath] : []), [fontPath]);
  const themes = useCachedFiles(isNeeded ? THEME_FILES : null, themePlan);
  const fonts = useCachedFiles(isNeeded ? FONT_FILES : null, fontPlan);

  const projectFonts = useMemo(
    () =>
      isNeeded
        ? resolveProjectFonts(settings, {
            themes: settledSource(themes.loadedFile, themes.isLoading),
            fonts: settledSource(fonts.loadedFile, fonts.isLoading),
          })
        : NO_PROJECT_FONTS,
    [isNeeded, settings, themes.loadedFile, themes.isLoading, fonts.loadedFile, fonts.isLoading]
  );
  return { projectFonts, isLoading: themes.isLoading || fonts.isLoading };
}
