/**
 * The table a procedural texture resolves in: the slot's own, with the saved Gradient and
 * FastNoiseLite files the texture names added once they load (`textures/savedTextureSources.ts`).
 * A file that fails to load shows as a **Missing resource**, and the texture draws nothing. While a
 * file loads, the texture is on its way, not missing.
 */

import { useCallback, useMemo } from 'react';
import type { TscnExternalResource, TscnInternalResource } from '../parser/types.js';
import { savedSourcePaths, withSavedSources } from './textures/savedTextureSources.js';
import { PARSED_RESOURCES, useCachedFiles } from './useLoadedFiles.js';

interface SavedTextureSources {
  internalResources: readonly TscnInternalResource[];
  /** True while a file the texture names has neither loaded nor failed. */
  isLoading: boolean;
}

export function useSavedTextureSources(
  ref: string | undefined,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[]
): SavedTextureSources {
  const paths = useMemo(
    () => savedSourcePaths(ref, externalResources, internalResources),
    [ref, externalResources, internalResources]
  );
  // A texture that names no file listens to no bus: most Texture2D slots are images.
  const plan = useCallback(() => paths, [paths]);
  const { loadedFile, isLoading } = useCachedFiles(paths.length > 0 ? PARSED_RESOURCES : null, plan);
  const resolvedResources = useMemo(
    () => withSavedSources(ref, externalResources, internalResources, loadedFile),
    [ref, externalResources, internalResources, loadedFile]
  );
  return { internalResources: resolvedResources, isLoading };
}
