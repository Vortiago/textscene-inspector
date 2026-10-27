/**
 * The `.tres` files, the font files and the project fonts a mesh build reads, loaded together: a
 * font plan may read a file the first plan loaded, as a CSG shape's mesh names its font. A caller
 * that needs no font passes `readsFonts` false, and the hook listens to no font bus.
 */

import { useCallback } from 'react';
import type { ProjectFonts } from './fonts/font/projectFonts';
import type { FontResource } from './fonts/font/types';
import type { LoadedFile, LoadedFont } from './scopedResource';
import { FONT_FILES, useCachedFiles, useLoadedFiles } from './useLoadedFiles';
import { useProjectFonts } from './useProjectFonts';

export interface LoadedFilesAndFonts {
  loadedFile: LoadedFile;
  loadedFont: LoadedFont;
  projectFonts: ProjectFonts;
  /** True while a file, a font or a project font a plan names has neither loaded nor failed. */
  isLoading: boolean;
  /** True while a font or a project font has neither loaded nor failed. */
  isLoadingFonts: boolean;
}

/** A caller keeps both plans stable while their inputs hold, as `useLoadedFiles` asks. */
export function useLoadedFilesAndFonts(
  filesPlan: (loadedFile: LoadedFile) => readonly string[],
  fontsPlan: (
    loadedFont: LoadedFont,
    loadedFile: LoadedFile,
    projectFonts: ProjectFonts
  ) => readonly string[],
  readsFonts: boolean
): LoadedFilesAndFonts {
  const files = useLoadedFiles(filesPlan);
  const { projectFonts, isLoading: isLoadingProjectFonts } = useProjectFonts(readsFonts);
  const readFonts = useCallback(
    (loadedFont: LoadedFont) => fontsPlan(loadedFont, files.loadedFile, projectFonts),
    [fontsPlan, files.loadedFile, projectFonts]
  );
  const fonts = useCachedFiles<FontResource>(readsFonts ? FONT_FILES : null, readFonts);
  const isLoadingFonts = fonts.isLoading || isLoadingProjectFonts;
  return {
    loadedFile: files.loadedFile,
    loadedFont: fonts.loadedFile,
    projectFonts,
    isLoading: files.isLoading || isLoadingFonts,
    isLoadingFonts,
  };
}
