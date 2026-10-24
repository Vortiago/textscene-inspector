/**
 * The Font a property of a resource names, resolved against the font files loaded so far. A pure
 * walk, so a builder reads a font without a hook, and the caller loads each path the walk read.
 */

import type { SceneResources } from '../../../r3f/SceneResourcesContext';
import type { LoadedFont } from '../../scopedResource';
import { resolveInlineFontResource } from './decode';
import type { FontResource } from './types';

export interface ResolvedFont {
  /** Null for no font, a font that failed, and while a file it reads loads. */
  font: FontResource | null;
  /** Every font file the walk read, loaded or not. */
  paths: string[];
}

/** Resolves `ref` in `resources` through `loadedFont`. */
export function resolveFontReference(
  ref: string | undefined,
  { externalResources, internalResources }: SceneResources,
  loadedFont: LoadedFont
): ResolvedFont {
  const paths: string[] = [];
  const font = resolveInlineFontResource(
    ref,
    externalResources,
    internalResources,
    {
      getCached: (path) => {
        paths.push(path);
        return loadedFont(path);
      },
    },
    new Set()
  );
  return { font, paths };
}
