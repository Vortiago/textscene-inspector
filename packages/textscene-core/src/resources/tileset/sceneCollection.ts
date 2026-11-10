/**
 * The decode of a `TileSetScenesCollectionSource`: each scene tile's PackedScene reference and
 * `display_placeholder`. Part of the TileSet slice's decode (ADR-0031).
 */

import { warn } from '../../logger';
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
const SCENE_KEY_RE = indexedKeyRegex('^scenes/(#)/(scene|display_placeholder)$', 'is_valid_int');

export function resolveSceneCollectionSource(
  source: TscnInternalResource,
  tables: SceneTables
): SceneCollectionSourceModel {
  const scenes = new Map<number, SceneTileModel>();
  for (const [key, value] of Object.entries(source.data)) {
    const match = SCENE_KEY_RE.exec(key);
    if (!match) continue;
    const sceneId = stringToInt(match[1]!);
    // `create_scene_tile` honours an override only from 0 up and otherwise takes `next_scene_id`
    // (`tile_set.cpp:5781-5783`), which depends on every other tile: the tile is dropped, not misplaced.
    if (sceneId < 0) {
      warn(`[TileSet] scene tile ${key}: Godot re-assigns a negative scene id — skipped`);
      continue;
    }
    // Either key makes the tile (`tile_set.cpp:5877-5884`), so one written first is not lost to the other.
    const tile = scenes.get(sceneId) ?? { scene: null, displayPlaceholder: false };
    scenes.set(sceneId, tile);
    if (match[2] === 'scene') tile.scene = sceneOf(value, tables);
    else tile.displayPlaceholder = boolSlotValue(value) === true;
  }
  return { scenes };
}

/** The scene `value` names, or null for `null` or a reference that names no resource. */
function sceneOf(value: string, tables: SceneTables): SceneTileModel['scene'] {
  return parseResourceReference(value)?.type === 'ExtResource'
    ? { ref: value, externalResources: tables.externalResources, internalResources: tables.internalResources }
    : null;
}
