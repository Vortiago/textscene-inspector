/**
 * The declaration of one `PropertyListHelper` family (`item_<N>/<leaf>`): the engine facts the
 * validator, the past-count rule and the parser grouping all derive from, stated once per class.
 * The leaves are the keys of the validator table, which is their one list.
 */

import type { IndexParse } from './indexedKey.js';

/**
 * Where the family's length lives. `key` is the `ADD_ARRAY_COUNT` property. A class that serialises
 * no count declares a null key with the engine line that shows it.
 */
export type CountKey = { readonly key: string } | { readonly key: null; readonly cite: string };

/**
 * What the helper does with an index at or past the length. `dropped`: `_get_property` refuses it
 * (`property_list_helper.cpp:58`). `assigned`: the class enabled `allow_oob_assign`, so the write lands.
 */
export interface OutOfBounds {
  readonly policy: 'dropped' | 'assigned';
  /** The engine `file:line` that decides the policy, and the grounding of a past-count rule's arm. */
  readonly at: string;
}

export interface IndexedFamily {
  /** The class that serialises the family. */
  readonly owner: string;
  /** The glued prefix: `item_` for `item_0/text`, `popup/item_` for MenuButton. */
  readonly prefix: string;
  readonly indexParse: IndexParse;
  readonly countKey: CountKey;
  readonly outOfBounds: OutOfBounds;
}

/**
 * Identity at runtime. The `const` parameter keeps each literal (`'dropped'`, a null key), so derivations narrow on the declaration and a field left out does not compile.
 */
export function defineIndexedFamily<const F extends IndexedFamily>(family: F): F {
  return family;
}
