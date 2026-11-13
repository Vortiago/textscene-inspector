/**
 * `TileSetScenesCollectionSource` validation. It hand-builds `_get_property_list`
 * (tile_set.cpp:5906-5917) and `_set` (:5864-5892), so its only keys are
 * `scenes/<id>/scene` and `scenes/<id>/display_placeholder`. `linterValidators.ts` registers them.
 */

import { v } from '../../linter/validators/index.js';
import { indexedFamilyValidator } from '../../linter/validators/indexedFamily.js';

export const sceneTileValidator = indexedFamilyValidator({
  prefix: 'scenes/',
  leaves: {
    // tile_set.cpp:5908, a PackedScene OBJECT slot. `_set` (:5877) passes the Variant
    // to `set_scene_tile_scene`, which stores a null Ref as a tile with no scene.
    scene: v.resourceReference('scene'),
    // tile_set.cpp:5909, Variant::BOOL.
    display_placeholder: v.boolean('display_placeholder'),
  },
  unknownCode: 'INVALID_TILESET_SCENE_TILE_KEY',
  describes: 'TileSet scene tile',
  accepts: 'scenes/<id>/<leaf>',
  // `_set` gates the id on `is_valid_int()` (tile_set.cpp:5870-5874).
  indexParse: 'is_valid_int',
  negativeIndex: {
    // `create_scene_tile` takes an id override only from 0 up (:5781-5783).
    cite: 'tile_set.cpp:5781',
    code: 'INVALID_TILESET_SCENE_TILE_ID',
    message: (index) =>
      `Scene id ${index} must be non-negative: create_scene_tile honours an id override only ` +
      'from 0 up (tile_set.cpp:5781), so the tile takes next_scene_id instead of this id',
  },
});
