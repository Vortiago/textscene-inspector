/**
 * The `terrain_set_<n>/` family — TileSet's one family that carries a second
 * index (tile_set.cpp:3893-3927, :4190-4194).
 *
 * `mode` is the shared dispatcher's own `<prefix><i>/<leaf>` shape;
 * `terrain_<m>/name` and `terrain_<m>/color` are a nested indexed family, which
 * that dispatcher deliberately does not reach, so the key grammar for them is
 * built here from `indexedKeyRegex`.
 */

import { indexedFamilyValidator } from '../../linter/validators/indexedFamily.js';
import { accepts, keyShapeError, v } from '../../linter/validators/index.js';
import { indexedKeyRegex } from '../../godot/index.js';
import { terrainColor } from './terrainColor.js';
import type { PropertyValidator } from '../../linter/ValidatorRegistry.js';

const negativeTerrainSet = (index: number): string =>
  `Terrain-set index ${index} must be non-negative. TileSet::_set fails ` +
  'ERR_FAIL_COND_V(terrain_set_index < 0, false) (tile_set.cpp:3896) before the ' +
  'terrain set is reached, so the write never lands';

/** tile_set.h:238-242, TerrainMode. */
const TERRAIN_MODE = {
  0: 'TERRAIN_MODE_MATCH_CORNERS_AND_SIDES',
  1: 'TERRAIN_MODE_MATCH_CORNERS',
  2: 'TERRAIN_MODE_MATCH_SIDES',
};

/**
 * The nested level, gated the same way `_set` gates it: `components[1]` must
 * begin `terrain_` and `is_valid_int()` past that prefix (tile_set.cpp:3904).
 * A spelling the gate refuses matches nothing here and falls through to the
 * flat dispatcher, which reports the key as unknown — which is what `_set` does
 * with it.
 */
const TERRAIN_KEY = indexedKeyRegex('^terrain_set_(#)/terrain_(#)/(.+)$', 'is_valid_int');

/** `terrain_set_<i>/mode` carrying a segment below the leaf, which `_set` ignores. */
const MODE_TRAILING_RE = indexedKeyRegex('^terrain_set_(#)/mode/', 'is_valid_int');

const TERRAIN_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // tile_set.cpp:4193, Variant::STRING; :3907 refuses a non-string.
  name: v.quotedString('name'),
  color: terrainColor,
};

/**
 * `terrain_set_<n>/mode`, plus every key shape the nested branch below did not
 * claim — an unrecognised leaf, a refused index, a negative one.
 */
const terrainSetLeaves = indexedFamilyValidator({
  prefix: 'terrain_set_',
  leaves: {
    // tile_set.cpp:4190, PROPERTY_HINT_ENUM. set_terrain_set_mode (:773) casts
    // the int into the enum and assigns it; its only guard is on the INDEX.
    mode: v.enumInt('mode', 0, 2, TERRAIN_MODE, { hinted: 'tile_set.cpp:4190' }),
  },
  unknownCode: 'INVALID_TILESET_TERRAIN_SET_KEY',
  describes: 'TileSet terrain set',
  accepts: 'terrain_set_<i>/mode and terrain_set_<i>/terrain_<j>/<leaf>',
  // `components[0].trim_prefix("terrain_set_").is_valid_int()` (:3893).
  indexParse: 'is_valid_int',
  negativeIndex: {
    cite: 'tile_set.cpp:3896',
    code: 'INVALID_TILESET_TERRAIN_SET_INDEX',
    message: negativeTerrainSet,
  },
});

/**
 * The whole family, registered under the `#/**` routing shape because its two
 * levels are one family behind one glued prefix.
 */
export const terrainSetValidator: PropertyValidator = accepts((key, value, line) => {
  const nested = TERRAIN_KEY.exec(key);
  if (!nested) {
    // `_set` splits with `split("/", true, 2)` (:3666), so `components[1]` is
    // ONE segment and anything below it rides along unread: `terrain_set_0/mode/x`
    // reaches `components[1] == "mode"` (:3897) and the write lands. The
    // dispatcher takes the leaf as everything below the index, so the segment is
    // trimmed before it sees the key.
    const trailing = MODE_TRAILING_RE.exec(key);
    if (trailing) {
      const error = terrainSetLeaves(`terrain_set_${trailing[1]}/mode`, value, line);
      // `propertyError` puts the column at `key.length + 3`, the value's own
      // position, so a trimmed key would point left of it.
      return error && { ...error, column: key.length + 3 };
    }
    return terrainSetLeaves(key, value, line);
  }

  // `_set` tests the terrain-set index BEFORE it looks at `components[1]`
  // (:3896 against :3904), so the outer guard is the one that reports.
  const setIndex = Number(nested[1]);
  if (setIndex < 0) {
    return keyShapeError(
      key,
      line,
      negativeTerrainSet(setIndex),
      'INVALID_TILESET_TERRAIN_SET_INDEX'
    );
  }
  const terrainIndex = Number(nested[2]);
  if (terrainIndex < 0) {
    return keyShapeError(
      key,
      line,
      `Terrain index ${terrainIndex} must be non-negative. TileSet::_set fails ` +
        'ERR_FAIL_COND_V(terrain_index < 0, false) (tile_set.cpp:3905) before the terrain ' +
        'is reached, so the write never lands',
      'INVALID_TILESET_TERRAIN_INDEX'
    );
  }

  const leafName = nested[3]!;
  if (!Object.prototype.hasOwnProperty.call(TERRAIN_LEAVES, leafName)) {
    return keyShapeError(
      key,
      line,
      `Unknown TileSet terrain property: "${key}"`,
      'INVALID_TILESET_TERRAIN_KEY'
    );
  }
  return TERRAIN_LEAVES[leafName]!(key, value, line);
}, 'terrain_set_<i>/mode and terrain_set_<i>/terrain_<j>/<leaf>');

// The only values this dispatcher refuses on its own authority are a negative
// index at either level and an unrecognised leaf, all three of which `_set`
// refuses; every other bound lives in the leaves, exposed so `boundGrounding`'s
// sweep recurses past this function.
terrainSetValidator.grounding = { kind: 'enforced', cite: 'tile_set.cpp:3896, tile_set.cpp:3905' };
terrainSetValidator.leaves = [terrainSetLeaves, ...Object.values(TERRAIN_LEAVES)];
