/**
 * The `.tres` files and the font files a mesh build reads, loaded together: a font plan may read a
 * file the first plan loaded, as a CSG shape's mesh names its font. A caller that needs no font
 * passes `readsFonts` false, and the hook listens to no font bus.
 */

import { useCallback } from 'react';
import type { FontResource } from './fonts/font/types';
import type { LoadedFile, LoadedFont } from './scopedResource';
import { FONT_FILES, useCachedFiles, useLoadedFiles } from './useLoadedFiles';

export interface LoadedFilesAndFonts {
  loadedFile: LoadedFile;
  loadedFont: LoadedFont;
  /** True while a file or a font a plan names has neither loaded nor failed. */
  isLoading: boolean;
  /** True while a font a plan names has neither loaded nor failed. */
  isLoadingFonts: boolean;
}

/** A caller keeps both plans stable while their inputs hold, as `useLoadedFiles` asks. */
export function useLoadedFilesAndFonts(
  filesPlan: (loadedFile: LoadedFile) => readonly string[],
  fontsPlan: (loadedFont: LoadedFont, loadedFile: LoadedFile) => readonly string[],
  readsFonts: boolean
): LoadedFilesAndFonts {
  const files = useLoadedFiles(filesPlan);
  const readFonts = useCallback(
    (loadedFont: LoadedFont) => fontsPlan(loadedFont, files.loadedFile),
    [fontsPlan, files.loadedFile]
  );
  const fonts = useCachedFiles<FontResource>(readsFonts ? FONT_FILES : null, readFonts);
  return {
    loadedFile: files.loadedFile,
    loadedFont: fonts.loadedFile,
    isLoading: files.isLoading || fonts.isLoading,
    isLoadingFonts: fonts.isLoading,
  };
}
