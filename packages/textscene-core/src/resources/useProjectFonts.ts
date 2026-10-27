/**
 * The project font context as a hook: loads the theme and the font that `project.godot` names, for
 * a reader outside the Control solve tree, such as a TextMesh. The solve tree resolves the same
 * context through `resolveProjectFonts` in its own walk.
 */

import { useCallback, useMemo } from 'react';
import { useProjectSettings } from '../r3f/contexts/ProjectSettingsContext';
import {
  projectFontPaths,
  resolveProjectFonts,
  NO_PROJECT_FONTS,
  type ProjectFonts,
} from './fonts/font/projectFonts';
import { FONT_FILES, THEME_FILES, useCachedFiles } from './useLoadedFiles';

export interface LoadedProjectFonts {
  projectFonts: ProjectFonts;
  /** True while the theme or the font has neither loaded nor failed. */
  isLoading: boolean;
}

/** The files themselves are what the hook loads, so a path still pending is read as absent here. */
const IGNORED = { themes: new Set<string>(), fonts: new Set<string>() };

/**
 * A caller that reads no project font passes `isNeeded` false: the hook then loads nothing and
 * listens to no bus.
 *
 * @canonical The project theme and project default font, for a node outside the Control solve tree
 */
export function useProjectFonts(isNeeded: boolean): LoadedProjectFonts {
  const { settings } = useProjectSettings();
  const paths = useMemo(() => projectFontPaths(settings), [settings]);
  const themePlan = useCallback(() => (paths.theme ? [paths.theme] : []), [paths]);
  const fontPlan = useCallback(() => (paths.font ? [paths.font] : []), [paths]);
  const themes = useCachedFiles(isNeeded ? THEME_FILES : null, themePlan);
  const fonts = useCachedFiles(isNeeded ? FONT_FILES : null, fontPlan);

  const projectFonts = useMemo(
    () =>
      isNeeded
        ? resolveProjectFonts(
            settings,
            { themes: { getCached: themes.loadedFile }, fonts: { getCached: fonts.loadedFile } },
            IGNORED
          )
        : NO_PROJECT_FONTS,
    [isNeeded, settings, themes.loadedFile, fonts.loadedFile]
  );
  return { projectFonts, isLoading: themes.isLoading || fonts.isLoading };
}
