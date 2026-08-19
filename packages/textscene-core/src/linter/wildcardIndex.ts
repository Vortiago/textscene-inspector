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
 *   below the index. `item_0/text`.
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
 * The prefix used to be re-derived on every lookup (`pattern.slice(0, -2) + '/'`,
 * two allocations per candidate) and a miss is the common case, so the work
 * landed on the hot path for every unregistered property of every node. Slicing
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
 * Whether `key` is `<prefix><index>/<leaf>`, the shape Godot's
 * `PropertyListHelper` writes for an indexed property array.
 *
 * This is ROUTING, not acceptance, and the two are deliberately different
 * widths. The engine splits the key at the LAST `/`
 * (`property_list_helper.cpp:47`) and requires what sits between the prefix and
 * that slash to be `is_valid_int()` (`:53`); when it is not, `_get_property`
 * returns nullptr, `_set` returns false, and the write is DROPPED. That drop is
 * exactly the ADR-0032 error tier, so the key has to REACH the family's
 * dispatcher for anything to report it. Matching the engine's acceptance here
 * instead is how `item_x/text` reached no validator and read as clean, the same
 * failure a leading sign once had: `item_-1/text` routed nowhere, so the
 * dispatcher's negative-index diagnostic could never fire.
 *
 * So the index half is matched by SHAPE alone — non-empty, and no `/` of its
 * own. Whether those characters are an integer, and what a non-integer means,
 * belongs to the dispatcher: Godot has two index parses and they disagree about
 * it (`indexedFamily.ts`'s `indexParse`), which is a per-class fact this matcher
 * cannot know. Every matcher below holds to the same split.
 *
 * The no-`/` rule is the engine's `rsplit(…, 1)` restated: `item_0/deep/text`
 * puts `item_0/deep` in the index half, which is no integer under either parse,
 * so `#/*` addresses ONE leaf segment. A family whose leaves nest deeper
 * registers `#/**` (a glued prefix) or the plain `<prefix>/*` (a `/`-separated
 * one) instead.
 *
 * `lastIndexOf` plus `indexOf` rather than `split`, because `findOwnValidator`
 * runs for every property of every node and a miss must not allocate.
 */
export function matchesIndexedKey(key: string, prefix: string): boolean {
  if (!key.startsWith(prefix)) return false;
  const slash = key.lastIndexOf('/');
  // The leaf must be non-empty, and the index must sit between the two.
  if (slash <= prefix.length || slash === key.length - 1) return false;
  // No `/` inside the index half, which is what makes that last slash the
  // engine's rsplit point rather than one buried in a nested leaf name.
  return key.indexOf('/', prefix.length) === slash;
}

/**
 * Whether `key` is `<prefix><index>/<anything>`, the shape a class that builds
 * its own property list writes when one family spans several depths.
 *
 * The index ends at the FIRST `/` past the prefix and everything below is the
 * dispatcher's problem, so `terrain_set_0/mode` and
 * `terrain_set_0/terrain_1/name` both route to the one registration that owns
 * the family. Splitting at the last `/` instead — what {@link matchesIndexedKey}
 * does — would read an index of `0/terrain_1` and route neither.
 *
 * Both halves need only be NON-EMPTY. A `terrain_set_/mode` names no element and
 * a `terrain_set_0/` names no leaf, and Godot's `split("/", true, 2)` hands
 * `_set` an empty component for each; every branch there compares that component
 * against a literal name and none matches, so the write is dropped before any
 * index is read.
 */
export function matchesIndexedSubtree(key: string, prefix: string): boolean {
  if (!key.startsWith(prefix)) return false;
  const slash = key.indexOf('/', prefix.length);
  return slash > prefix.length && slash < key.length - 1;
}

/**
 * Whether `key` is `<prefix><index>` and nothing else — a family whose whole key
 * below the prefix IS the index.
 *
 * `TileSet::_set` reaches its `pattern_` branch only at `components.size() == 1`
 * (`tile_set.cpp:3995`), so a `/` anywhere past the prefix puts the key in some
 * other branch and this one must not claim it.
 */
export function matchesTerminalIndex(key: string, prefix: string): boolean {
  if (!key.startsWith(prefix) || key.length === prefix.length) return false;
  return key.indexOf('/', prefix.length) < 0;
}
