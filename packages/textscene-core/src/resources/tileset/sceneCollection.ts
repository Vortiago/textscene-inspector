/**
 * The decode of a `TileSetScenesCollectionSource`: each scene tile's scene file and
 * `display_placeholder`. A value that names no PackedScene gives the tile no scene, as the property
 * takes a PackedScene. Part of the TileSet slice's decode (ADR-0031).
 */

import { indexedKeyRegex } from '../../godot/classdb/indexedKey.js';
import { stringToInt } from '../../godot/string/string.js';
import { boolSlotValue } from '../../godot/variant/variantBool.js';
import { PACKED_SCENE, type SceneFile } from '../formats/packedscene/kind';
import type { Follow } from '../reading';
import type { SceneCollectionSourceModel, SceneTileModel } from './types';

/** `(next_scene_id % 1073741823) + 1`: the ids wrap at 2 ** 30 (`tile_set.cpp:5741`). */
const MAX_SCENE_ID = 1073741823;

/**
 * `_set` splits the name into at most three parts and gates the id on `is_valid_int()`, which skips
 * one leading sign (`tile_set.cpp:5870-5874`). Any other leaf sets nothing (`:5892`).
 */
const SCENE_KEY_RE = indexedKeyRegex('^scenes/(#)/(scene|display_placeholder)$', 'is_valid_int');

/** A `TileSetScenesCollectionSource` from its properties. Each scene resolves in the file that holds the source. */
export function decodeSceneCollectionSource(
  properties: Readonly<Record<string, string>>,
  follow: Follow
): SceneCollectionSourceModel {
  const scenes = new Map<number, SceneTileModel>();
  // One scene file per value, so the tiles that name a scene share one instance node and step.
  const sceneByValue = new Map<string, SceneFile | null>();
  const sharedSceneOf = (value: string): SceneFile | null => {
    if (!sceneByValue.has(value)) sceneByValue.set(value, follow.read(PACKED_SCENE, value).value);
    return sceneByValue.get(value)!;
  };
  // `next_scene_id`, advanced past the taken ids after each created tile (`tile_set.cpp:5739-5743`).
  let nextSceneId = 1;
  const createTile = (id: number, scene: SceneFile | null): SceneTileModel => {
    // `create_scene_tile` takes the override only from 0 up and otherwise `next_scene_id` (`:5781-5783`).
    const newId = id >= 0 ? id : nextSceneId;
    const tile = { scene, displayPlaceholder: false };
    scenes.set(newId, tile);
    while (scenes.has(nextSceneId)) nextSceneId = (nextSceneId % MAX_SCENE_ID) + 1;
    return tile;
  };
  for (const [key, value] of Object.entries(properties)) {
    const match = SCENE_KEY_RE.exec(key);
    if (!match) continue;
    const sceneId = stringToInt(match[1]!);
    const existing = scenes.get(sceneId);
    if (match[2] === 'scene') {
      const scene = sharedSceneOf(value);
      if (existing) existing.scene = scene;
      else createTile(sceneId, scene);
    } else {
      // A missing tile is created empty. The flag then lands on the tile of that id, which a
      // negative id never names, so `set_scene_tile_display_placeholder` fails (`:5844-5845`).
      const tile = existing ?? createTile(sceneId, null);
      if (sceneId >= 0) tile.displayPlaceholder = boolSlotValue(value) === true;
    }
  }
  return { scenes };
}
