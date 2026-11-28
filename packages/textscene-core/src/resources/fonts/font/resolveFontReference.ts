/**
 * The Font a property of a resource names, read as `FONT` against the font files loaded so far. A
 * pure walk, so a builder reads a font without a hook, and the caller loads each path the walk read.
 */

import type { SceneResources } from '../../../r3f/SceneResourcesContext';
import { nodeReference } from '../../reading/scopedReference';
import { snapshotOver } from '../../reading/snapshot';
import type { CachedFileReader } from '../../useLoadedFiles';
import { FONT } from './kind';
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
  resources: SceneResources,
  loadedFont: CachedFileReader<FontResource>
): ResolvedFont {
  // A kept decode checks a file again before a new decode reads it, so a path can be read twice.
  const paths = new Set<string>();
  const snapshot = snapshotOver({
    owner: loadedFont.owner,
    // FONT reads a font file whole through `loaded`, so the walk parses no file.
    getCached: () => undefined,
    loaded: (_fileKind, address) => {
      paths.add(address);
      return loadedFont(address);
    },
  });
  return { font: snapshot.read(nodeReference(ref, resources), FONT).value, paths: [...paths] };
}
