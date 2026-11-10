/**
 * The decode of a `TileSetScenesCollectionSource`: each scene tile's PackedScene reference and
 * `display_placeholder`. Part of the TileSet slice's decode (ADR-0031).
 */

import { indexedKeyRegex } from '../../godot/classdb/indexedKey.js';
import { stringToInt } from '../../godot/string/string.js';
import { boolSlotValue } from '../../godot/variant/variantBool.js';
import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import { parseResourceReference } from '../SubResourceResolver';
import type { SceneCollectionSourceModel, SceneTileModel } from './types';

/** The tables a scene reference resolves in: those of the file that holds the TileSet. */
interface SceneTables {
  externalResources: readonly TscnExternalResource[];
  internalResources: readonly TscnInternalResource[];
}

/**
 * `_set` splits the name into at most three parts and gates the id on `is_valid_int()`, which skips
 * one leading sign (`tile_set.cpp:5870-5874`). Any other leaf sets nothing (`:5892`).
 */
/** `(next_scene_id % 1073741823) + 1`: the ids wrap at 2 ** 30 (`tile_set.cpp:5741`). */
const MAX_SCENE_ID = 1073741823;

const SCENE_KEY_RE = indexedKeyRegex('^scenes/(#)/(scene|display_placeholder)$', 'is_valid_int');

export function resolveSceneCollectionSource(
  source: TscnInternalResource,
  tables: SceneTables
): SceneCollectionSourceModel {
  const scenes = new Map<number, SceneTileModel>();
  // `next_scene_id`, advanced past the taken ids after each created tile (`tile_set.cpp:5739-5743`).
  let nextSceneId = 1;
  const createTile = (id: number, scene: TileScene | null): SceneTileModel => {
    // `create_scene_tile` takes the override only from 0 up and otherwise `next_scene_id` (`:5781-5783`).
    const newId = id >= 0 ? id : nextSceneId;
    const tile = { scene, displayPlaceholder: false };
    scenes.set(newId, tile);
    while (scenes.has(nextSceneId)) nextSceneId = (nextSceneId % MAX_SCENE_ID) + 1;
    return tile;
  };
  for (const [key, value] of Object.entries(source.data)) {
    const match = SCENE_KEY_RE.exec(key);
    if (!match) continue;
    const sceneId = stringToInt(match[1]!);
    const existing = scenes.get(sceneId);
    if (match[2] === 'scene') {
      const scene = sceneOf(value, tables);
      if (existing) existing.scene = scene;
      else createTile(sceneId, scene);
    } else {
      // A missing tile is created empty. The flag then lands on the tile of that id, which a
      // negative id never names, so `set_scene_tile_display_placeholder` fails (`:5844-5845`).
      const tile = existing ?? createTile(sceneId, null);
      if (scenes.get(sceneId) === tile) tile.displayPlaceholder = boolSlotValue(value) === true;
    }
  }
  return { scenes };
}

/** The scene `value` names, or null for `null` or a reference that names no resource. */
function sceneOf(value: string, tables: SceneTables): SceneTileModel['scene'] {
  return parseResourceReference(value)?.type === 'ExtResource'
    ? { ref: value, externalResources: tables.externalResources, internalResources: tables.internalResources }
    : null;
}
