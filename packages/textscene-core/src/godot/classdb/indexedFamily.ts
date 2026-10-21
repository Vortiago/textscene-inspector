/**
 * The declaration of one `PropertyListHelper` family (`item_<N>/<leaf>`): the engine facts the
 * validator, the past-count rule and the parser grouping all derive from, stated once per class.
 */

import type { IndexParse } from './indexedKey.js';

/**
 * Where the family's length lives. `key` is the `ADD_ARRAY_COUNT` property, or null for a class that
 * serialises no count; either way `cite` is the engine line that shows it.
 */
export type CountKey =
  { readonly key: string; readonly cite: string } | { readonly key: null; readonly cite: string };

/**
 * What the helper does with an index at or past the length. `dropped`: `_get_property` refuses it
 * (`property_list_helper.cpp:58`). `assigned`: the class enabled `allow_oob_assign`, so the write lands.
 */
export interface OutOfBounds {
  readonly policy: 'dropped' | 'assigned';
  /** `file:line` pairs, comma-separated, of the engine code that decides the policy. */
  readonly cite: string;
}

export interface IndexedFamily {
  /** The class that serialises the family. */
  readonly owner: string;
  /** The glued prefix: `item_` for `item_0/text`, `popup/item_` for MenuButton. */
  readonly prefix: string;
  readonly indexParse: IndexParse;
  readonly countKey: CountKey;
  /** The leaf names below an index, one segment each. */
  readonly leaves: readonly string[];
  readonly outOfBounds: OutOfBounds;
}

/** A family with a count key, the shape the past-count rule reads. */
export type CountedFamily = IndexedFamily & { readonly countKey: { readonly key: string } };

/**
 * Identity at runtime. The `const` parameter keeps each literal (`'dropped'`, the leaf names, a
 * null key), so derivations narrow on the declaration and a field left out does not compile.
 */
export function defineIndexedFamily<const F extends IndexedFamily>(family: F): F {
  return family;
}
