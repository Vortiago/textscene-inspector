/**
 * The wildcard half of a type's own validator lookup. Godot writes four key shapes,
 * and `buildWildcardIndex` settles each registration's shape once, not on every miss
 * in `ValidatorRegistry.findOwnValidator`.
 */

import type { PropertyValidator } from './propertyValidator.js';

/** Which shape a wildcard registration is, and so which matcher answers for it. */
export type WildcardKind = 'path' | 'indexedLeaf' | 'indexedSubtree' | 'indexedTerminal';

/**
 * A wildcard registration with its prefix sliced off once. A miss is the common
 * case, so a slice per lookup (two allocations per candidate) would sit on the hot
 * path. A retained prefix makes the lookup one `startsWith`, and the loop skips the
 * exact keys, which outnumber the wildcards.
 */
export interface WildcardEntry {
  /** `bones/` for `bones/*`, `item_` for `item_#/*`, `pattern_` for `pattern_#`. */
  prefix: string;
  kind: WildcardKind;
  validator: PropertyValidator;
}

/**
 * The wildcard patterns of a type's own validators, each with its prefix sliced
 * and its shape settled. The glued shapes go first: `terrain_set_#/**` ends in `/*`
 * too, and the plain slice would leave a `#` in its prefix.
 */
export function buildWildcardIndex(own: Record<string, PropertyValidator>): WildcardEntry[] {
  const entries: WildcardEntry[] = [];
  for (const pattern in own) {
    const validator = own[pattern];
    if (!validator) continue;
    if (pattern.endsWith('#/**')) {
      // `terrain_set_#/**`: a glued index over a leaf that may nest. `TileSet` writes
      // `terrain_set_0/mode` beside `terrain_set_0/terrain_1/name`
      // (`tile_set.cpp:4190`, `:4193-4194`).
      entries.push({ prefix: pattern.slice(0, -4), kind: 'indexedSubtree', validator });
    } else if (pattern.endsWith('#/*')) {
      // `item_#/*`: `PropertyListHelper` glues the index to the prefix
      // (`vformat("%s%d/%s", prefix, i, name)`, `property_list_helper.cpp:149`) and
      // splits it off at the last `/` (`:47`), so one leaf sits below it: `item_0/text`.
      entries.push({ prefix: pattern.slice(0, -3), kind: 'indexedLeaf', validator });
    } else if (pattern.endsWith('/*')) {
      // `bones/*`: a literal `/` ends the prefix, and any depth below it matches:
      // `bones/0/position`. Such a prefix cannot express `terrain_set_` or `pattern_`.
      entries.push({ prefix: pattern.slice(0, -2) + '/', kind: 'path', validator });
    } else if (pattern.endsWith('#')) {
      // `pattern_#`: a glued index ends the key, with no leaf below it (`tile_set.cpp:4230`).
      entries.push({ prefix: pattern.slice(0, -1), kind: 'indexedTerminal', validator });
    }
  }
  return entries;
}

/**
 * Whether `key` has a `/` past `prefix`: the routing for a `PropertyListHelper`
 * indexed array, and no acceptance. `item_count` has no `/` and is another property.
 * The dispatcher owns the index text and the leaf, since Godot's two index parses
 * disagree per class (`indexedFamily.ts`'s `indexParse`).
 */
export function matchesIndexedKey(key: string, prefix: string): boolean {
  // The engine splits at the last `/` (`property_list_helper.cpp:47`), needs an
  // `is_valid_int()` index (`:53`) and a declared leaf (`:63`), and else drops the
  // write: the ADR-0032 error tier, so `item_x/text` or `item_0/` must still route.
  // `indexOf`, not `split`: this runs for every property of every node.
  return key.startsWith(prefix) && key.indexOf('/', prefix.length) >= 0;
}

/**
 * The same routing for a family whose leaves nest, as its own kind so the
 * registration states the shape. The dispatcher takes the index up to the first `/`
 * and the rest as the leaf, so `terrain_set_0/mode` and `terrain_set_0/terrain_1/name`
 * reach one registration.
 */
export function matchesIndexedSubtree(key: string, prefix: string): boolean {
  // An empty index fails `is_valid_int()` (`tile_set.cpp:3893`) and an empty leaf
  // matches no branch (`:3897`, `:3904`): `_set` returns false, a dropped write.
  return matchesIndexedKey(key, prefix);
}

/**
 * Whether `key` has no `/` past `prefix`, so the whole rest is the index.
 * `TileSet::_set` reaches its `pattern_` branch only at `components.size() == 1`
 * (`tile_set.cpp:3995`). The bare prefix routes too: its empty index fails that
 * line's `is_valid_int()`, a dropped write.
 */
export function matchesTerminalIndex(key: string, prefix: string): boolean {
  return key.startsWith(prefix) && key.indexOf('/', prefix.length) < 0;
}
