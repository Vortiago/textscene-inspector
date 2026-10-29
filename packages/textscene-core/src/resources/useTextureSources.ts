/**
 * Loads the saved Gradient and FastNoiseLite files a procedural texture names
 * (`textures/textureSourceFiles.ts`). A file that fails to load shows as a **Missing resource**, and
 * the texture draws nothing. While one loads, the texture is on its way, not missing.
 */

import { useCallback, useMemo } from 'react';
import type { ParsedResource } from '../parser/parsedResource.js';
import type { SceneResources } from '../r3f/SceneResourcesContext.js';
import { textureSourceFiles } from './textures/textureSourceFiles.js';
import { PARSED_RESOURCES, useCachedFiles, type CachedFiles } from './useLoadedFiles.js';

export function useTextureSources(
  ref: string | undefined,
  pools: SceneResources
): CachedFiles<ParsedResource> {
  const files = useMemo(() => textureSourceFiles(ref, pools), [ref, pools]);
  const plan = useCallback(() => files, [files]);
  // A texture that names no file listens to no bus: most Texture2D slots are images.
  return useCachedFiles(files.length > 0 ? PARSED_RESOURCES : null, plan);
}
