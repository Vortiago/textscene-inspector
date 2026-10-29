/**
 * Loads the saved Gradient and FastNoiseLite files a procedural texture names
 * (`textures/textureSourceFiles.ts`). A file that fails to load shows as a **Missing resource**, and
 * the texture draws nothing. While one loads, the texture is on its way, not missing, and `ref`
 * resolves to nothing: a build started without a source would be thrown away.
 */

import { useCallback, useMemo } from 'react';
import type { TscnExternalResource, TscnInternalResource } from '../parser/types.js';
import type { SceneResources } from '../r3f/SceneResourcesContext.js';
import type { LoadedFile } from './scopedResource.js';
import { textureSourceFiles } from './textures/textureSourceFiles.js';
import { PARSED_RESOURCES, useCachedFiles } from './useLoadedFiles.js';

interface TextureSources {
  /** The tables `ref` resolves in, one object while they hold. */
  pools: SceneResources;
  loadedFile: LoadedFile;
  /** True while a file the texture names has neither loaded nor failed. */
  isLoading: boolean;
  /** `ref`, or undefined while a file loads. */
  readyRef: string | undefined;
}

export function useTextureSources(
  ref: string | undefined,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[]
): TextureSources {
  const pools = useMemo(
    () => ({ externalResources, internalResources }),
    [externalResources, internalResources]
  );
  const files = useMemo(() => textureSourceFiles(ref, pools), [ref, pools]);
  const plan = useCallback(() => files, [files]);
  // A texture that names no file listens to no bus: most Texture2D slots are images.
  const { loadedFile, isLoading } = useCachedFiles(files.length > 0 ? PARSED_RESOURCES : null, plan);
  return { pools, loadedFile, isLoading, readyRef: isLoading ? undefined : ref };
}
