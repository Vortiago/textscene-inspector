/**
 * The three TileSet families with no leaf name in the key: `sources/<id>`,
 * `pattern_<n>` and `tile_proxies/<level>` (tile_set.cpp:3961-4006, :4218-4230).
 * `indexedFamilyValidator` resolves by leaf name, so `indexedKeyRegex` puts the
 * index last instead.
 */

import {
  accepts,
  arrayLiteralElements,
  keyShapeError,
  nilShapeError,
  propertyError,
  v,
} from '../../linter/validators/index.js';
import {
  dropTrailingComma,
  indexedKeyRegex,
  isNilLiteral,
  splitTopLevel,
  stringToInt,
} from '../../godot/index.js';
import { writtenIndex } from '../../linter/reportedIndices.js';
import type { PropertyValidator } from '../../linter/ValidatorRegistry.js';

const unknownKey = (key: string, line: number, describes: string, code: string) =>
  keyShapeError(key, line, `Unknown TileSet ${describes} property: "${key}"`, code);

/**
 * A resource slot whose `add_*` opens with `ERR_FAIL_COND_V(…is_null())`, so null
 * is not legal here. `_set` passes the Variant unexamined (`add_source(p_value,
 * source_id)` at tile_set.cpp:3968, `add_pattern(p_value)` at :3997), so a bare
 * `null` arrives as a null `Ref`.
 */
function requiredResource(name: string, cite: string, code: string): PropertyValidator {
  const format = v.resourceReference(name);
  const validator: PropertyValidator = (key, value, line) => {
    const bad = format(key, value, line);
    if (bad) return bad;
    if (!isNilLiteral(value)) return null;
    // `nilShapeError` keeps this message. The strict parser would otherwise claim
    // the slot stores a zero value, but an OBJECT slot converts `NIL` and then
    // refuses it, so nothing is stored.
    return nilShapeError(
      key,
      line,
      `'${key}' must name a resource: TileSet::add_${name} refuses a cleared slot with ` +
        `ERR_FAIL_COND_V(…is_null()) (${cite}), so nothing is stored`,
      code
    );
  };
  // Not format-only: it refuses `null`, a value Godot's parser reads and every
  // other resource slot stores, so it owes the guard's own citation.
  validator.grounding = { kind: 'enforced', cite };
  validator.accepts = 'SubResource("id") or ExtResource("id")';
  return validator;
}

/** `TileSet::_set` gates the source id on `components[1].is_valid_int()` (:3961). */
const SOURCE_KEY = indexedKeyRegex('^sources/(#)$', 'is_valid_int');
const sourceResource = requiredResource('source', 'tile_set.cpp:477', 'INVALID_TILESET_SOURCE');

/**
 * `sources/<id>`: the atlas sources, `PROPERTY_USAGE_NO_EDITOR` (storage only) at
 * tile_set.cpp:4218. `-1` is `TileSet::INVALID_SOURCE` (tile_set.h:214), so it clears
 * :479's guard and re-seats at `next_source_id` (:481). Anything below is refused.
 */
export const sourceValidator: PropertyValidator = accepts((key, value, line) => {
  const match = SOURCE_KEY.exec(key);
  if (!match) return unknownKey(key, line, 'source', 'INVALID_TILESET_SOURCE_KEY');
  // `int source_id = components[1].to_int()` (:3963).
  const id = stringToInt(match[1]!);
  if (id === -1) {
    return keyShapeError(
      key,
      line,
      `Source id ${writtenIndex(match[1]!, id)} is TileSet::INVALID_SOURCE, so add_source ` +
        're-seats the source at the auto-assigned next_source_id (tile_set.cpp:481) and no ' +
        'cell can address it by -1',
      'INVALID_TILESET_SOURCE_ID'
    );
  }
  if (id < 0) {
    return keyShapeError(
      key,
      line,
      `Source id ${writtenIndex(match[1]!, id)} must be non-negative: add_source fails ` +
        'ERR_FAIL_COND_V_MSG("Negative source IDs are not allowed") (tile_set.cpp:479), ' +
        'so the source is never added',
      'INVALID_TILESET_SOURCE_ID'
    );
  }
  return sourceResource(key, value, line);
}, 'sources/<id> = SubResource("id") naming a TileSetSource');
sourceValidator.grounding = { kind: 'enforced', cite: 'tile_set.cpp:477, tile_set.cpp:479' };
sourceValidator.leaves = [sourceResource];

/** `trim_prefix("pattern_").is_valid_int()` (:3995). */
const PATTERN_KEY = indexedKeyRegex('^pattern_(#)$', 'is_valid_int');
const patternResource = requiredResource('pattern', 'tile_set.cpp:1359', 'INVALID_TILESET_PATTERN');

/**
 * `pattern_<n>`: a `TileMapPattern` slot keyed by its index (tile_set.cpp:4230). A
 * negative index is dropped silently: the fill loop `for (int i = patterns.size();
 * i <= pattern_index; i++)` (:3997) never runs, and `_set` returns true.
 */
export const patternValidator: PropertyValidator = accepts((key, value, line) => {
  const match = PATTERN_KEY.exec(key);
  if (!match) return unknownKey(key, line, 'pattern', 'INVALID_TILESET_PATTERN_KEY');
  // `int pattern_index = ….to_int()` (:3996).
  const index = stringToInt(match[1]!);
  if (index < 0) {
    return keyShapeError(
      key,
      line,
      `Pattern index ${writtenIndex(match[1]!, index)} must be non-negative: TileSet::_set fills patterns with ` +
        '`for (int i = patterns.size(); i <= pattern_index; i++)` (tile_set.cpp:3997), ' +
        'which adds nothing for a negative index, and still reports success',
      'INVALID_TILESET_PATTERN_INDEX'
    );
  }
  return patternResource(key, value, line);
}, 'pattern_<n> = SubResource("id") naming a TileMapPattern');
patternValidator.grounding = { kind: 'enforced', cite: 'tile_set.cpp:3997, tile_set.cpp:1359' };
patternValidator.leaves = [patternResource];

/**
 * The three levels `_set` has a branch for (:3974, :3979, :3986), each with its
 * own format validator so the diagnostic names the level rather than the group.
 */
const PROXY_LEVELS: Readonly<Record<string, PropertyValidator>> = {
  // `_set` gates on the Variant type alone (`p_value.get_type() != Variant::ARRAY`,
  // tile_set.cpp:3971), and a typed Array is `Variant::ARRAY`, so
  // `Array[int]([0, 4, 2, 4])` loads as the bare literal does.
  source_level: v.arrayLiteral('source_level', { anyElementType: true }),
  coords_level: v.arrayLiteral('coords_level', { anyElementType: true }),
  alternative_level: v.arrayLiteral('alternative_level', { anyElementType: true }),
};

/**
 * `tile_proxies/<level>`: three `Variant::ARRAY` slots, `PROPERTY_USAGE_NO_EDITOR`
 * (tile_set.cpp:4224-4226). Each is read pairwise, so `_set` refuses an odd length
 * (`ERR_FAIL_COND_V(a.size() % 2 != 0, false)`, :3973). The elements go unchecked:
 * each pair goes to a `set_*_tile_proxy`, whose guards are about ids.
 */
export const tileProxyValidator: PropertyValidator = accepts((key, value, line) => {
  const level = key.slice('tile_proxies/'.length);
  if (!Object.prototype.hasOwnProperty.call(PROXY_LEVELS, level)) {
    return unknownKey(key, line, 'tile proxy', 'INVALID_TILESET_TILE_PROXY_KEY');
  }
  const bad = PROXY_LEVELS[level]!(key, value, line);
  if (bad) return bad;
  const elements = dropTrailingComma(splitTopLevel(arrayLiteralElements(value)));
  if (elements.length % 2 === 0) return null;
  return propertyError(
    key,
    line,
    `'${key}' must hold an even number of elements — each proxy is a from/to pair, and ` +
      '_set fails ERR_FAIL_COND_V(a.size() % 2 != 0, false) (tile_set.cpp:3973) — got ' +
      `${elements.length}`,
    'INVALID_TILESET_TILE_PROXY_VALUE'
  );
}, 'Array of from/to pairs (even length)');
tileProxyValidator.grounding = { kind: 'enforced', cite: 'tile_set.cpp:3973' };
tileProxyValidator.leaves = Object.values(PROXY_LEVELS);
