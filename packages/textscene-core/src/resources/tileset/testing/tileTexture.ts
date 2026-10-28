/** Builds the `texture` slot of a test atlas source. */

import type { TileTexture } from '../types';

/** A source's `texture` slot naming the file at `path`, with no tables and no holders. */
export function tileTextureAt(path: string): TileTexture {
  return { ref: path, externalResources: [], internalResources: [], holders: [] };
}
