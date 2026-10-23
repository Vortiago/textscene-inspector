/**
 * A mesh with the files its build reads, loaded through the resource loader: a trail mesh whose
 * `curve` is an ExtResource builds once that file has loaded.
 */

import { useCallback, useMemo } from 'react';
import type { ResolvableResource, ScopedResource } from '../scopedResource';
import { useLoadedFiles } from '../useLoadedFiles';
import { primitiveMeshFiles } from './primitivemesh/surface';

export interface ResolvableMesh {
  /** Null for no mesh, and while a file the build reads loads. */
  mesh: ResolvableResource | null;
  /** True while a file the build reads has neither loaded nor failed. */
  isLoading: boolean;
}

export function useResolvableMesh(scoped: ScopedResource | null): ResolvableMesh {
  const plan = useCallback(() => (scoped ? primitiveMeshFiles(scoped) : []), [scoped]);
  const { loadedFile, isLoading } = useLoadedFiles(plan);
  const mesh = useMemo(
    () => (scoped && !isLoading ? { ...scoped, loadedFile } : null),
    [scoped, loadedFile, isLoading]
  );
  return { mesh, isLoading };
}
