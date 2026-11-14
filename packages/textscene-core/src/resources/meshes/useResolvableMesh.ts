/**
 * A mesh with the files its build reads, loaded through the resource loader: a trail mesh whose
 * `curve` is an ExtResource builds once that file has loaded, and a TextMesh once its font file and
 * the outlines and metrics of that font have.
 */

import { useCallback, useMemo } from 'react';
import type { LoadedFont, ResolvableResource, ScopedResource } from '../scopedResource';
import { useLoadedFilesAndFonts } from '../useLoadedFilesAndFonts';
import { usePendingWhile } from '../usePendingWhile';
import {
  isAwaitingFont,
  primitiveMeshFiles,
  primitiveMeshFontFiles,
  primitiveMeshReadsFont,
} from './primitivemesh/surface';
import { useWatchedSettledFonts } from '../../r3f/controls/native/text/useSettledFont';
import { useLayoutDirectionEnv } from '../../r3f/contexts/useLayoutDirectionEnv';

export interface ResolvableMesh {
  /** Null for no mesh, and while a file, or the outlines or metrics the build reads, load. */
  mesh: ResolvableResource | null;
  /** True while a file the build reads has neither loaded nor failed, or its font awaits its outlines or metrics. */
  isLoading: boolean;
}

export function useResolvableMesh(scoped: ScopedResource | null): ResolvableMesh {
  const filesPlan = useCallback(() => (scoped ? primitiveMeshFiles(scoped) : []), [scoped]);
  const fontsPlan = useCallback(
    (loadedFont: LoadedFont) => (scoped ? primitiveMeshFontFiles(scoped, loadedFont) : []),
    [scoped]
  );
  const readsFonts = scoped !== null && primitiveMeshReadsFont(scoped.resource.type);
  const { loadedFile, loadedFont, projectFonts, isLoading } = useLoadedFilesAndFonts(
    filesPlan,
    fontsPlan,
    readsFonts
  );
  const locale = useLayoutDirectionEnv().applicationLocale;
  // Watched: a new store once a load the build read settles, so the memo below reads it again.
  const settledFonts = useWatchedSettledFonts();
  const loaded = useMemo(
    () =>
      scoped && !isLoading ? { ...scoped, loadedFile, loadedFont, projectFonts, settledFonts, locale } : null,
    [scoped, isLoading, loadedFile, loadedFont, projectFonts, settledFonts, locale]
  );
  const hasFontPending = loaded !== null && isAwaitingFont(loaded);
  usePendingWhile(hasFontPending);
  return {
    mesh: hasFontPending ? null : loaded,
    isLoading: isLoading || hasFontPending,
  };
}
