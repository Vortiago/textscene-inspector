/**
 * The Font a property of a scene or of a resource names, as the loader's font cache holds it. An
 * ExtResource loads its file on the font bus, and a SubResource decodes in the scene's own tables.
 */

import { useCallback, useMemo } from 'react';
import type { SceneResources } from '../../../r3f/SceneResourcesContext';
import { useCachedFiles, type CachedFileReader, type FileKind } from '../../useLoadedFiles';
import { resolveInlineFontResource } from './decode';
import type { FontResource } from './types';

/** A font file loads on the font bus. */
const FONT_FILES: FileKind<FontResource> = { busTypes: ['font'], cacheOf: (loader) => loader.fonts };

export interface FontLoad {
  /** Null for no font, a font that failed, and while a file it reads loads. */
  font: FontResource | null;
  /** True while a font file the property reads has neither loaded nor failed. */
  isLoading: boolean;
}

/** Resolves `ref` against the cache `read` answers, and returns the font with every path the walk read. */
function resolveFont(
  ref: string | undefined,
  { externalResources, internalResources }: SceneResources,
  read: CachedFileReader<FontResource | null>
): { font: FontResource | null; paths: string[] } {
  const paths: string[] = [];
  const font = resolveInlineFontResource(
    ref,
    externalResources,
    internalResources,
    {
      getCached: (path) => {
        paths.push(path);
        return read(path);
      },
    },
    new Set()
  );
  return { font, paths };
}

export function useFontResource(ref: string | undefined, resources: SceneResources): FontLoad {
  const plan = useCallback(
    (read: CachedFileReader<FontResource>) => resolveFont(ref, resources, read).paths,
    [ref, resources]
  );
  const { loadedFile, isLoading } = useCachedFiles(FONT_FILES, plan);
  const font = useMemo(() => resolveFont(ref, resources, loadedFile).font, [ref, resources, loadedFile]);
  return { font, isLoading };
}
