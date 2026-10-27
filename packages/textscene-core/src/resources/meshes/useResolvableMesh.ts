/**
 * A mesh with the files its build reads, loaded through the resource loader: a trail mesh whose
 * `curve` is an ExtResource builds once that file has loaded, and a TextMesh once its font file and
 * the metrics of that font have.
 */

import { useCallback, useMemo } from 'react';
import type { LoadedFont, ResolvableResource, ScopedResource } from '../scopedResource';
import { useLoadedFilesAndFonts } from '../useLoadedFilesAndFonts';
import { usePendingWhile } from '../usePendingWhile';
import {
  isAwaitingFontMetrics,
  primitiveMeshFiles,
  primitiveMeshFontFiles,
  primitiveMeshReadsFont,
} from './primitivemesh/surface';
import { useFontMetricsSettleCount } from './textmesh/useFontMetricsSettleCount';

export interface ResolvableMesh {
  /** Null for no mesh, and while a file or the metrics the build reads load. */
  mesh: ResolvableResource | null;
  /** True while a file the build reads has neither loaded nor failed, or its font awaits its metrics. */
  isLoading: boolean;
}

export function useResolvableMesh(scoped: ScopedResource | null): ResolvableMesh {
  const filesPlan = useCallback(() => (scoped ? primitiveMeshFiles(scoped) : []), [scoped]);
  const fontsPlan = useCallback(
    (loadedFont: LoadedFont) => (scoped ? primitiveMeshFontFiles(scoped, loadedFont) : []),
    [scoped]
  );
  const readsFonts = scoped !== null && primitiveMeshReadsFont(scoped.resource.type);
  const {
    loadedFile,
    loadedFont,
    isLoading: isLoadingFiles,
  } = useLoadedFilesAndFonts(filesPlan, fontsPlan, readsFonts);
  const loaded = useMemo(
    () => (scoped && !isLoadingFiles ? { ...scoped, loadedFile, loadedFont } : null),
    [scoped, isLoadingFiles, loadedFile, loadedFont]
  );
  const isAwaitingMetrics = loaded !== null && isAwaitingFontMetrics(loaded);
  // The count moves the render that reads the metrics again, once they settle.
  useFontMetricsSettleCount(isAwaitingMetrics);
  usePendingWhile(isAwaitingMetrics);
  return {
    mesh: isAwaitingMetrics ? null : loaded,
    isLoading: isLoadingFiles || isAwaitingMetrics,
  };
}
