/**
 * The TileSet kinds: a TileSet and each kind of its sources, from a scene or from a file.
 * `TileSet::_set` adds the source it receives for `sources/<n>` (`tile_set.cpp:3961-3968`), which
 * the loader resolved from either origin, so a reference in a source resolves in the file that
 * holds the source. No THREE.
 */

import { warn } from '../../logger';
import type { Follow, ResourceKind } from '../reading';
import { decodeAtlasSource, decodeTileGrid, writtenSources } from './decode';
import { decodeSceneCollectionSource } from './sceneCollection';
import type { AtlasSourceModel, SceneCollectionSourceModel, TileSetModel } from './types';

export const TILE_SET_ATLAS_SOURCE: ResourceKind<AtlasSourceModel> = {
  name: 'TileSetAtlasSource',
  accepts: (type) => type === 'TileSetAtlasSource',
  decode: ({ properties }, follow) => decodeAtlasSource(properties, follow),
};

export const TILE_SET_SCENES_COLLECTION_SOURCE: ResourceKind<SceneCollectionSourceModel> = {
  name: 'TileSetScenesCollectionSource',
  accepts: (type) => type === 'TileSetScenesCollectionSource',
  decode: ({ properties }, follow) => decodeSceneCollectionSource(properties, follow),
};

export const TILE_SET: ResourceKind<TileSetModel> = {
  name: 'TileSet',
  accepts: (type) => type === 'TileSet',
  decode: ({ properties }, follow) => ({
    ...decodeTileGrid(properties),
    ...decodeSources(properties, follow),
  }),
};

function decodeSources(
  properties: Readonly<Record<string, string>>,
  follow: Follow
): Pick<TileSetModel, 'sources' | 'sceneSources'> {
  const sources = new Map<number, AtlasSourceModel>();
  const sceneSources = new Map<number, SceneCollectionSourceModel>();
  // `sources/1`, `sources/01` and `sources/+1` are one source: `_set` drops the id before
  // re-adding (tile_set.cpp:3965-3968), so the last value wins, as `Map.set` does. One id names
  // one source, so a source of the other kind under it goes.
  for (const { key, id, ref } of writtenSources(properties)) {
    const atlas = follow.read(TILE_SET_ATLAS_SOURCE, ref);
    if (atlas.status === 'loaded') {
      sceneSources.delete(id);
      sources.set(id, atlas.value);
      continue;
    }
    const scenes =
      atlas.status === 'unavailable' && atlas.reason === 'wrong-type'
        ? follow.read(TILE_SET_SCENES_COLLECTION_SOURCE, ref)
        : atlas;
    if (scenes.status === 'loaded') {
      sources.delete(id);
      sceneSources.set(id, scenes.value);
    } else if (scenes.status === 'unavailable' && scenes.reason === 'wrong-type')
      warn(`[TileSet] source ${key}: unsupported source type in "${ref}", skipped`);
    else if (scenes.status !== 'pending')
      warn(`[TileSet] source ${key}: unresolvable reference "${ref}", skipped`);
  }
  return { sources, sceneSources };
}
