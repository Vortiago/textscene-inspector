/**
 * The wildcard half of a type's own validator lookup.
 *
 * Two shapes, because Godot writes two — `bones/*` and `item_#/*` — and telling
 * them apart is a per-registration fact, so it is decided once here rather than
 * on every miss in `ValidatorRegistry.findOwnValidator`.
 */

import type { PropertyValidator } from './propertyValidator.js';

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
  /** `bones/` for `bones/*`, `item_` for `item_#/*`. */
  prefix: string;
  /** True for the `#/*` shape, whose index is glued to the prefix. */
  indexed: boolean;
  validator: PropertyValidator;
}

/** Extract the wildcard patterns from a type's own validators, prefixes pre-sliced. */
export function buildWildcardIndex(own: Record<string, PropertyValidator>): WildcardEntry[] {
  const entries: WildcardEntry[] = [];
  for (const pattern in own) {
    if (!pattern.endsWith('/*')) continue;
    const validator = own[pattern];
    if (!validator) continue;
    const indexed = pattern.endsWith('#/*');
    entries.push({
      prefix: indexed ? pattern.slice(0, -3) : pattern.slice(0, -2) + '/',
      indexed,
      validator,
    });
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
 * cannot know.
 *
 * The no-`/` rule is the engine's `rsplit(…, 1)` restated: `item_0/deep/text`
 * puts `item_0/deep` in the index half, which is no integer under either parse,
 * so `#/*` addresses ONE leaf segment. A family whose leaves nest deeper
 * registers the plain `<prefix>*` wildcard instead.
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
