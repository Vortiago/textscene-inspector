/**
 * Reads a test TileSet through the `TILE_SET` kind, from the tables of a scene or from a parsed
 * resource file, as the tile nodes read it. Null for a read that does not load.
 */

import type { ParsedResource } from '../../../parser/parsedResource';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import { nodeReference, snapshotOver } from '../../reading';
import { staticSnapshot } from '../../reading/staticSnapshot.testkit';
import { resourceFilePath } from '../../subResourcePath';
import { TILE_SET } from '../kind';
import type { TileSetModel } from '../types';

/** The TileSet `ref` names in a scene with these tables, over the resource files `files` holds by path. */
export function tileSetInScene(
  ref: string,
  internalResources: readonly TscnInternalResource[],
  externalResources: readonly TscnExternalResource[],
  files: Readonly<Record<string, string>> = {}
): TileSetModel | null {
  const read = staticSnapshot(files).read(
    nodeReference(ref, { internalResources, externalResources }),
    TILE_SET
  );
  return read.value;
}

/** The TileSet at `path` in the file `parsed`: its `[resource]`, or a sub-resource by `file::id`. */
export function tileSetInFile(parsed: ParsedResource, path: string): TileSetModel | null {
  const file = resourceFilePath(path);
  const snapshot = snapshotOver({ getCached: (asked) => (asked === file ? parsed : null) });
  return snapshot.read(nodeReference(path, { internalResources: [], externalResources: [] }), TILE_SET).value;
}
