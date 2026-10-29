/**
 * The table a procedural texture resolves in: the slot's own, with the saved Gradient and
 * FastNoiseLite files the texture names added once they load (`textures/savedTextureSources.ts`).
 * A file that fails to load shows as a **Missing resource**, and the texture draws nothing.
 */

import { useCallback, useMemo } from 'react';
import type { TscnExternalResource, TscnInternalResource } from '../parser/types.js';
import { savedSourcePaths, withSavedSources } from './textures/savedTextureSources.js';
import { useLoadedFiles } from './useLoadedFiles.js';

export function useSavedTextureSources(
  ref: string | undefined,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[]
): readonly TscnInternalResource[] {
  const plan = useCallback(
    () => savedSourcePaths(ref, internalResources, externalResources),
    [ref, internalResources, externalResources]
  );
  const { loadedFile } = useLoadedFiles(plan);
  return useMemo(
    () => withSavedSources(ref, internalResources, externalResources, loadedFile),
    [ref, internalResources, externalResources, loadedFile]
  );
}
