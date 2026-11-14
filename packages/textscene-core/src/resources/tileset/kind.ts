/**
 * The TileSet kinds: a TileSet and each of its sources, from a scene or from a file.
 * `TileSet::_set` adds the source it receives for `sources/<n>` (`tile_set.cpp:3961-3968`), which
 * the loader resolved from either origin, so a reference in a source resolves in the file that
 * holds the source. No THREE.
 */

import { indexedKeyRegex } from '../../godot/classdb/indexedKey.js';
import { stringToInt } from '../../godot/string/string.js';
import { warn } from '../../logger';
import type { Follow, HeldResource, ResourceKind, UnavailableReason } from '../reading';
import { decodeAtlasSource, decodeTileGrid } from './decode';
import { decodeSceneCollectionSource } from './sceneCollection';
import type { AtlasSourceModel, SceneCollectionSourceModel, TileSetModel } from './types';

/** A TileSet source, by its class. */
type TileSetSource =
  | { readonly form: 'atlas'; readonly atlas: AtlasSourceModel }
  | { readonly form: 'scenes'; readonly scenes: SceneCollectionSourceModel };

type SourceDecode = (held: HeldResource, follow: Follow) => TileSetSource;

const SOURCES: Readonly<Record<string, SourceDecode>> = {
  TileSetAtlasSource: ({ properties }, follow) => ({
    form: 'atlas',
    atlas: decodeAtlasSource(properties, follow),
  }),
  TileSetScenesCollectionSource: ({ properties }, follow) => ({
    form: 'scenes',
    scenes: decodeSceneCollectionSource(properties, follow),
  }),
};

/** A TileSetAtlasSource or a TileSetScenesCollectionSource. Another class answers `wrong-type`. */
const TILE_SET_SOURCE: ResourceKind<TileSetSource> = {
  name: 'TileSetSource',
  accepts: (type) => Object.hasOwn(SOURCES, type),
  decode: (held, follow) => SOURCES[held.type]!(held, follow),
};

export const TILE_SET: ResourceKind<TileSetModel> = {
  name: 'TileSet',
  accepts: (type) => type === 'TileSet',
  decode: ({ properties }, follow) => ({
    ...decodeTileGrid(properties),
    ...decodeSources(properties, follow),
  }),
};

/**
 * `TileSet::_set` gates the source id on `components[1].is_valid_int()`
 * (tile_set.cpp:3961), which skips ONE leading sign (ustring.cpp:4752), so
 * `sources/+3` is source 3. The id is `to_int()` stored in an `int` (:3963).
 */
const SOURCE_KEY_RE = indexedKeyRegex('^sources/(#)$', 'is_valid_int');

function decodeSources(
  properties: Readonly<Record<string, string>>,
  follow: Follow
): Pick<TileSetModel, 'sources' | 'sceneSources'> {
  const sources = new Map<number, AtlasSourceModel>();
  const sceneSources = new Map<number, SceneCollectionSourceModel>();
  const add = (id: number, source: TileSetSource) => {
    if (source.form === 'atlas') {
      sceneSources.delete(id);
      sources.set(id, source.atlas);
    } else {
      sources.delete(id);
      sceneSources.set(id, source.scenes);
    }
  };
  // `sources/1`, `sources/01` and `sources/+1` are one source: `_set` drops the id before
  // re-adding (tile_set.cpp:3965-3968), so the last value wins, as `Map.set` does. One id names
  // one source, so a source of the other kind under it goes.
  for (const { key, id, ref } of writtenSources(properties)) {
    const read = follow.read(TILE_SET_SOURCE, ref);
    if (read.status === 'loaded') add(id, read.value);
    else if (read.status === 'unavailable')
      warn(`[TileSet] source ${key}: ${UNREAD_REASONS[read.reason]} "${ref}", skipped`);
  }
  return { sources, sceneSources };
}

/** Why a source did not load, as a warning names it. */
const UNREAD_REASONS: Readonly<Record<UnavailableReason, string>> = {
  // TileSetSource is abstract (`register_scene_types.cpp:944`), so this is a resource of another class,
  // which casts to a null source that `add_source` refuses (`tile_set.cpp:477`).
  'wrong-type': 'resource that is no TileSetSource',
  'unknown-id': 'unresolvable reference',
  'missing-file': 'missing file',
  cycle: 'cyclic reference',
  undecodable: 'undecodable source',
};

/** One `sources/<n>` as written: its key, the id it adds and the reference it names. */
interface WrittenSource {
  key: string;
  id: number;
  ref: string;
}

/** Each `sources/<n>` of a TileSet with the id it adds, in the order `_set` adds them. */
function writtenSources(properties: Readonly<Record<string, string>>): WrittenSource[] {
  const sources: WrittenSource[] = [];
  for (const [key, ref] of Object.entries(properties)) {
    const match = SOURCE_KEY_RE.exec(key);
    if (!match) continue;
    const id = stringToInt(match[1]!);
    // `add_source` re-seats -1 at the auto-assigned `next_source_id` (tile_set.cpp:481)
    // and refuses anything below (:479). The landing id depends on every other
    // source, so the source is dropped, not misplaced.
    if (id < 0) {
      warn(`[TileSet] source ${key}: Godot re-assigns a negative source id, skipped`);
      continue;
    }
    sources.push({ key, id, ref });
  }
  return sources;
}
