/**
 * The two TileMap slots the tile data loads through, `format` and
 * `layer_<i>/tile_data`, shared by the phase-1 validators (linterParser.ts) and
 * the phase-2 rule (linter.ts) so one shape check answers both phases.
 */

import { accepts, propertyError } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { markIntSlot } from '../../../../linter/validators/intSlot.js';
import { badIntElement } from '../../../../linter/validators/v/packedArrays.js';
import { boolLiteralAsNumber, packedArrayLiteral, parseGodotFloat, ruleInt } from '../../../../godot/index.js';
import { replayPositions } from '../../../../godot/propertyReplay.js';

/** `format` initialises to TILE_MAP_DATA_FORMAT_3, which is 2 (tile_map.h:64). */
export const TILE_MAP_DATA_FORMAT_DEFAULT = 2;

/**
 * A literal the tokenizer types INT: an optional `-` and digits, nothing else
 * (variant_parser.cpp:420-448 — a `.` or an exponent makes it FLOAT).
 */
const INT_LITERAL_RE = /^-?\d+$/;

/**
 * `TileMap::_set` stores `format` only when `p_value.get_type() == Variant::INT`
 * (tile_map.cpp:688-691); any other Variant falls through every arm to
 * `return false` (:724), so a FLOAT or BOOL spelling is a DROPPED write and the
 * member keeps its default. The INT cast itself is unchecked — no ERR_FAIL, no
 * clamp — so no bound belongs here.
 */
export const formatValidator: PropertyValidator = accepts((key, value, line) => {
  const text = value.trim();
  if (INT_LITERAL_RE.test(text)) return null;
  if (parseGodotFloat(text) === null && boolLiteralAsNumber(text) === undefined) {
    return propertyError(key, line, `Property 'format' must be an integer, got: "${value}"`, 'INVALID_FORMAT_FORMAT');
  }
  return propertyError(
    key,
    line,
    `Property 'format' is stored only from an integer literal (tile_map.cpp:689); "${value}" is a dropped write, so the format stays ${TILE_MAP_DATA_FORMAT_DEFAULT}`,
    'INVALID_FORMAT_VALUE'
  );
}, 'INT-typed literal (a FLOAT or BOOL spelling is a dropped write, tile_map.cpp:689)');
formatValidator.grounding = { kind: 'enforced', cite: 'tile_map.cpp:689' };

/**
 * The `format` in effect when `key` (a `layer_<i>/tile_data`) is applied.
 *
 * Properties apply in file order, so only a `format` ABOVE the key governs its
 * decode; one below, or absent, leaves the default. So does any spelling that
 * is not an INT literal — a dropped write, {@link formatValidator}'s diagnostic.
 */
export function formatWhenApplied(rawProps: Record<string, string>, key: string): number {
  const raw = replayPositions(rawProps, key, ['format']).format!.applied;
  if (raw === undefined || !INT_LITERAL_RE.test(raw.trim())) return TILE_MAP_DATA_FORMAT_DEFAULT;
  // An INT literal past this reader's 2^53 is still an int64 the engine holds,
  // and not 2: NaN keeps it unequal to the default without naming a number.
  return ruleInt(raw, TILE_MAP_DATA_FORMAT_DEFAULT, 'int64') ?? Number.NaN;
}

// `\s*` at both ends and before the paren: Godot's tokenizer discards any
// character <= 32 before a token (variant_parser.cpp:415-417), so a padded
// `PackedInt32Array ( … )` loads, the same reasoning godot/variantParser.ts
// states for the NodePath and resource-ref literals.
const TILE_DATA_RE = packedArrayLiteral('PackedInt32Array');

/**
 * `layer_<i>/tile_data`: registered `PropertyInfo(Variant::PACKED_INT32_ARRAY,
 * "tile_data", PROPERTY_HINT_NONE, "", PROPERTY_USAGE_NO_EDITOR)`
 * (tile_map.cpp:1039), storage-bearing. Shape-only: the format-AWARE decode
 * (triplet layout, which depends on the sibling `format` property) is
 * `tilemap-invalid-tile-data`'s job (linter.ts), which runs this check first so
 * a value refused here is never reported twice.
 */
export const tileDataValidator: PropertyValidator = accepts((key, value, line) => {
  const match = TILE_DATA_RE.exec(value.trim());
  if (!match) {
    return propertyError(
      key,
      line,
      `Property 'tile_data' must be a PackedInt32Array like PackedInt32Array(0, 0, 0), got: "${value}"`,
      'INVALID_TILE_DATA_FORMAT'
    );
  }
  const body = match[1]!.trim();
  if (body === '') return null;
  // One pass: unreadable by the tokenizer, or read and then narrowed
  // away (_parse_construct<int32_t>, variant_parser.cpp:1428-1430).
  const bad = badIntElement('tile_data', key, line, body, {
    format: 'INVALID_TILE_DATA_FORMAT',
    value: 'INVALID_TILE_DATA_VALUE',
  });
  return bad.error ?? bad.truncated;
}, 'PackedInt32Array(…) of cell triplets (decoded by the tilemap-invalid-tile-data rule)');
// An INT slot, not format-only: it rejects a literal the tokenizer reads.
// The tag never reaches the registry — `indexedFamilyValidator` re-tags the
// family wrapper — but the `.leaves` sweep in validatorClassification reads it.
markIntSlot(tileDataValidator);
