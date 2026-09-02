/**
 * The wildcard half of a type's own validator lookup.
 *
 * Four shapes, because Godot writes four, and which one a registration is
 * is a per-registration fact — decided once here rather than on every miss in
 * `ValidatorRegistry.findOwnValidator`:
 *
 * - `bones/*` — a literal `/` follows the prefix, and any depth below it
 *   matches. `bones/0/position`.
 * - `item_#/*` — `PropertyListHelper` glues the index straight onto the prefix
 *   (`vformat("%s%d/%s", prefix, i, name)`, `property_list_helper.cpp:149`) and
 *   splits it back off at the LAST `/` (`:47`), so exactly ONE leaf segment sits
 *   below the index. `item_0/text`. Routing is wider than that shape, so the
 *   dispatcher can report the shapes the helper drops.
 * - `terrain_set_#/**` — a glued index over a leaf that may itself nest.
 *   `TileSet` builds its own property list and writes both depths of one family:
 *   `terrain_set_0/mode` beside `terrain_set_0/terrain_1/name`
 *   (`tile_set.cpp:4190`, `:4193-4194`).
 * - `pattern_#` — a glued index that ENDS the key, with no leaf below it at all
 *   (`tile_set.cpp:4230`).
 *
 * A glued prefix is why the last two exist. `bones/*` reaches any depth, but its
 * prefix always ends in `/`, so it can never express `terrain_set_` or
 * `pattern_`.
 */

import type { PropertyValidator } from './propertyValidator.js';

/** Which shape a wildcard registration is, and so which matcher answers for it. */
export type WildcardKind = 'path' | 'indexedLeaf' | 'indexedSubtree' | 'indexedTerminal';

/**
 * A wildcard registration with its prefix already sliced off the pattern.
 *
 * Re-deriving the prefix per lookup (`pattern.slice(0, -2) + '/'`, two
 * allocations per candidate) puts that work on the hot path for every
 * unregistered property of every node, and a miss is the common case. Slicing
 * once at registration makes the lookup a `startsWith` against a retained
 * string. It also lets the loop skip EXACT keys entirely: `Control` registers
 * far more of those than the six `theme_override_*` wildcards every Control
 * descendant inherits.
 */
export interface WildcardEntry {
  /** `bones/` for `bones/*`, `item_` for `item_#/*`, `pattern_` for `pattern_#`. */
  prefix: string;
  kind: WildcardKind;
  validator: PropertyValidator;
}

/**
 * Extract the wildcard patterns from a type's own validators, prefixes
 * pre-sliced and each one's shape settled.
 *
 * The glued shapes are tested before the plain `/*` one, because
 * `terrain_set_#/**` ends with `/*` too and the plain slice would leave a `#` in
 * its prefix.
 */
export function buildWildcardIndex(own: Record<string, PropertyValidator>): WildcardEntry[] {
  const entries: WildcardEntry[] = [];
  for (const pattern in own) {
    const validator = own[pattern];
    if (!validator) continue;
    if (pattern.endsWith('#/**')) {
      entries.push({ prefix: pattern.slice(0, -4), kind: 'indexedSubtree', validator });
    } else if (pattern.endsWith('#/*')) {
      entries.push({ prefix: pattern.slice(0, -3), kind: 'indexedLeaf', validator });
    } else if (pattern.endsWith('/*')) {
      entries.push({ prefix: pattern.slice(0, -2) + '/', kind: 'path', validator });
    } else if (pattern.endsWith('#')) {
      entries.push({ prefix: pattern.slice(0, -1), kind: 'indexedTerminal', validator });
    }
  }
  return entries;
}

/**
 * Whether `key` is `<prefix>…/…` — anything with a `/` past the prefix — the
 * routing for a `PropertyListHelper` indexed property array.
 *
 * This is ROUTING, not acceptance, and the two are deliberately different
 * widths. The engine splits the key at the LAST `/`
 * (`property_list_helper.cpp:47`), requires what sits between the prefix and
 * that slash to be `is_valid_int()` (`:53`), and looks the leaf up by name
 * (`:63`); when any of those fails, `_get_property` returns nullptr, `_set`
 * returns false, and the write is DROPPED. That drop is exactly the ADR-0032
 * error tier, so the key has to REACH the family's dispatcher for anything to
 * report it. Every shape the matcher once declined read as clean instead:
 * `item_x/text` and `item_-1/text` (a refused index), `item_/text` (an empty
 * one), `item_0/` (an empty leaf) and `item_0/text/extra` (an index half of
 * `0/text`, which is no integer).
 *
 * So the only structure asked for is the `/`. What the index text means
 * belongs to the dispatcher: Godot has two index parses and they disagree
 * about non-numeric text (`indexedFamily.ts`'s `indexParse`), which is a
 * per-class fact this matcher cannot know; and the dispatcher reads the leaf
 * from the FIRST `/`, so a nested leaf resolves to no declared name under
 * `is_valid_int` and to the hand-rolled `_set`'s fixed-depth read under
 * `to_int`. A key with no `/` at all (`item_count`) is a different property.
 *
 * `indexOf` rather than `split`, because `findOwnValidator` runs for every
 * property of every node and a miss must not allocate.
 */
export function matchesIndexedKey(key: string, prefix: string): boolean {
  return key.startsWith(prefix) && key.indexOf('/', prefix.length) >= 0;
}

/**
 * The same routing for a family whose leaves nest — one kind per registration
 * so the shape a class writes is stated where it is registered, while the
 * question asked of a key is the same: is there a `/` past the prefix?
 *
 * The dispatcher, not the matcher, reads the depth: it takes the index up to
 * the FIRST `/` and everything below as the leaf, so `terrain_set_0/mode` and
 * `terrain_set_0/terrain_1/name` both reach the one registration that owns the
 * family. An empty index (`terrain_set_/mode`) fails `is_valid_int()`
 * (`tile_set.cpp:3893`) and an empty leaf (`terrain_set_0/`) matches no branch
 * (`:3897`, `:3904`); each returns false from `_set`, a dropped write only the
 * dispatcher can report.
 */
export function matchesIndexedSubtree(key: string, prefix: string): boolean {
  return matchesIndexedKey(key, prefix);
}

/**
 * Whether `key` is `<prefix>…` with no `/` past the prefix — a family whose
 * whole key below the prefix IS the index.
 *
 * `TileSet::_set` reaches its `pattern_` branch only at `components.size() == 1`
 * (`tile_set.cpp:3995`), so a `/` anywhere past the prefix puts the key in some
 * other branch and this one must not claim it. The bare prefix routes: its
 * empty index fails the same line's `is_valid_int()`, a dropped write.
 */
export function matchesTerminalIndex(key: string, prefix: string): boolean {
  return key.startsWith(prefix) && key.indexOf('/', prefix.length) < 0;
}
