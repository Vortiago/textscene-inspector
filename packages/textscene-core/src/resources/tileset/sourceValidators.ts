/**
 * The three TileSet families whose key carries no leaf name: `sources/<id>`,
 * `pattern_<n>` and the fixed `tile_proxies/<level>` triple
 * (tile_set.cpp:3961-4006, :4218-4230).
 *
 * `sources/<id>` and `pattern_<n>` are an index and nothing else, so the shared
 * `indexedFamilyValidator` — which resolves by LEAF name — cannot express
 * either; the key grammar comes from `indexedKeyRegex` with the index in
 * terminal position instead.
 */

import { accepts, propertyError, v } from '../../linter/validators/index.js';
import { dropTrailingComma, indexedKeyRegex, isNilLiteral, splitTopLevel } from '../../godot/index.js';
import type { PropertyValidator } from '../../linter/ValidatorRegistry.js';

const unknownKey = (key: string, line: number, describes: string, code: string) =>
  propertyError(key, line, `Unknown TileSet ${describes} property: "${key}"`, code);

/**
 * A resource slot whose `add_*` method opens with an `ERR_FAIL_COND_V(…
 * is_null())`, so the usual "null is legal in every resource slot" does not
 * hold: the value is read, found empty, and nothing is added.
 *
 * `_set` reaches both guards with the Variant unexamined — `add_source(p_value,
 * source_id)` at tile_set.cpp:3968, and `add_pattern(p_value)` inside the fill
 * loop at :3997 — so a bare `null` in either key does arrive as a null `Ref`.
 *
 * `nilVerdict` keeps that message: the strict parser otherwise substitutes the
 * claim that the slot stores a zero value, which is what a slot whose
 * CONVERSION discards the null does. These are OBJECT slots, where `NIL` does
 * convert, and the refusal happens afterwards — nothing is stored at all.
 */
function requiredResource(name: string, cite: string, code: string): PropertyValidator {
  const format = v.resourceReference(name);
  const validator: PropertyValidator = (key, value, line) => {
    const bad = format(key, value, line);
    if (bad) return bad;
    if (!isNilLiteral(value)) return null;
    return propertyError(
      key,
      line,
      `'${key}' must name a resource: TileSet::add_${name} refuses a cleared slot with ` +
        `ERR_FAIL_COND_V(…is_null()) (${cite}), so nothing is stored`,
      code
    );
  };
  validator.nilVerdict = true;
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
 * `sources/<id>` — the atlas sources, `PROPERTY_USAGE_NO_EDITOR` (the storage
 * bit alone) at tile_set.cpp:4218.
 *
 * A negative id never names itself. `-1` IS `TileSet::INVALID_SOURCE`
 * (tile_set.h:214), so it clears :479's guard and is then re-seated at the
 * auto-assigned `next_source_id` (:481); anything below it is refused outright.
 */
export const sourceValidator: PropertyValidator = accepts((key, value, line) => {
  const match = SOURCE_KEY.exec(key);
  if (!match) return unknownKey(key, line, 'source', 'INVALID_TILESET_SOURCE_KEY');
  const id = Number(match[1]);
  if (id === -1) {
    return propertyError(
      key,
      line,
      'Source id -1 is TileSet::INVALID_SOURCE, so add_source re-seats the source at the ' +
        'auto-assigned next_source_id (tile_set.cpp:481) and no cell can address it by -1',
      'INVALID_TILESET_SOURCE_ID'
    );
  }
  if (id < 0) {
    return propertyError(
      key,
      line,
      `Source id ${id} must be non-negative: add_source fails ` +
        'ERR_FAIL_COND_V_MSG("Negative source IDs are not allowed") (tile_set.cpp:479), ' +
        'so the source is never added',
      'INVALID_TILESET_SOURCE_ID'
    );
  }
  return sourceResource(key, value, line);
}, 'sources/<id> = SubResource("id") naming a TileSetSource');
sourceValidator.grounding = { kind: 'enforced', cite: 'tile_set.cpp:477, tile_set.cpp:479' };
// The registry returns THIS function, so the tag has to sit here as well as on
// the leaf it forwards to.
sourceValidator.nilVerdict = true;
sourceValidator.leaves = [sourceResource];

/** `trim_prefix("pattern_").is_valid_int()` (:3995). */
const PATTERN_KEY = indexedKeyRegex('^pattern_(#)$', 'is_valid_int');
const patternResource = requiredResource('pattern', 'tile_set.cpp:1359', 'INVALID_TILESET_PATTERN');

/**
 * `pattern_<n>` — a `TileMapPattern` slot whose whole key below the prefix is
 * the index (tile_set.cpp:4230).
 *
 * A negative index is dropped in SILENCE rather than refused: `_set` fills up to
 * the index with `for (int i = patterns.size(); i <= pattern_index; i++)`
 * (:3997), which never runs when the index is below zero, and then returns true.
 */
export const patternValidator: PropertyValidator = accepts((key, value, line) => {
  const match = PATTERN_KEY.exec(key);
  if (!match) return unknownKey(key, line, 'pattern', 'INVALID_TILESET_PATTERN_KEY');
  const index = Number(match[1]);
  if (index < 0) {
    return propertyError(
      key,
      line,
      `Pattern index ${index} must be non-negative: TileSet::_set fills patterns with ` +
        '`for (int i = patterns.size(); i <= pattern_index; i++)` (tile_set.cpp:3997), ' +
        'which adds nothing for a negative index, and still reports success',
      'INVALID_TILESET_PATTERN_INDEX'
    );
  }
  return patternResource(key, value, line);
}, 'pattern_<n> = SubResource("id") naming a TileMapPattern');
patternValidator.grounding = { kind: 'enforced', cite: 'tile_set.cpp:3997, tile_set.cpp:1359' };
patternValidator.nilVerdict = true;
patternValidator.leaves = [patternResource];

/**
 * The three levels `_set` has a branch for (:3974, :3979, :3986), each with its
 * own format validator so the diagnostic names the level rather than the group.
 */
const PROXY_LEVELS: Readonly<Record<string, PropertyValidator>> = {
  source_level: v.arrayLiteral('source_level'),
  coords_level: v.arrayLiteral('coords_level'),
  alternative_level: v.arrayLiteral('alternative_level'),
};

/**
 * `tile_proxies/<level>` — three `Variant::ARRAY` slots, `PROPERTY_USAGE_NO_EDITOR`
 * (tile_set.cpp:4224-4226).
 *
 * Each array is read PAIRWISE — `for (int i = 0; i < a.size(); i += 2)` — so
 * `_set` refuses an odd length outright with
 * `ERR_FAIL_COND_V(a.size() % 2 != 0, false)` (:3973). The elements themselves
 * go unchecked: each pair is forwarded to a `set_*_tile_proxy` whose own guards
 * are about ids rather than about the literal.
 */
export const tileProxyValidator: PropertyValidator = accepts((key, value, line) => {
  const level = key.slice('tile_proxies/'.length);
  if (!Object.prototype.hasOwnProperty.call(PROXY_LEVELS, level)) {
    return unknownKey(key, line, 'tile proxy', 'INVALID_TILESET_TILE_PROXY_KEY');
  }
  const bad = PROXY_LEVELS[level]!(key, value, line);
  if (bad) return bad;
  const body = value.trim().slice(1, -1);
  const elements = dropTrailingComma(splitTopLevel(body));
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
