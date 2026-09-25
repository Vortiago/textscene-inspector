/** How Godot resolves an indexed property key: `item_0/text`, `settings/2/joints/1/bone`. */

import { IS_VALID_INT_RE, IS_VALID_INT_SOURCE, stringToInt } from './string.js';

/**
 * Which of Godot's two index resolutions a class uses, the union `indexedFamilyValidator`'s
 * `indexParse` takes. `'is_valid_int'`: `PropertyListHelper` gates before converting
 * (`property_list_helper.cpp:53-55`), so rejected text yields no index. `'to_int'`: a hand-rolled
 * list reads `get_slicec('/', n).to_int()` ungated (`bone_twist_disperser_3d.cpp:37`), so any text names an element.
 */
export type IndexParse = 'is_valid_int' | 'to_int';

/**
 * The text each parse admits at an index, as regex source. `is_valid_int` is {@link IS_VALID_INT_RE}'s
 * body: one optional sign, `+` or `-` (`ustring.cpp:4752`), then digits. `to_int` skips what it cannot
 * use (`ustring.cpp:2280-2293`), so it takes the whole segment and {@link stringToInt} reads it.
 * Non-empty, as in `indexedFamilyValidator`, so `settings//leaf` reaches neither phase.
 */
const INDEX_SOURCE: Readonly<Record<IndexParse, string>> = {
  is_valid_int: `(?:${IS_VALID_INT_SOURCE})`,
  to_int: '(?:[^/]+)',
};

/**
 * The grammar of one indexed key shape: anchored regex source with `(#)` where an index is captured
 * and `#` where it is only matched, so nested (`^settings/(#)/joints/(#)/twist_amount$`) and terminal
 * (`^collisions/#$`) indices both express. A builder, not a pattern string, keeps the digit class in
 * one file, which `indexedKeyGrammar.guard.test.ts` states absolutely.
 */
export function indexedKeyRegex(shape: string, indexParse: IndexParse): RegExp {
  return new RegExp(shape.replaceAll('#', INDEX_SOURCE[indexParse]));
}

/** One key of an indexed family that names an element, resolved as Godot resolves it. */
export interface IndexedKey {
  /** The whole key, as the file writes it. */
  key: string;
  /** The index as the file spells it. `5`, `+5` and `05` all name element 5. */
  indexText: string;
  /** The element Godot applies the key to: `to_int()` stored in an `int` ({@link stringToInt}). */
  index: number;
  /** The path below the index. */
  leaf: string;
  value: string;
}

/**
 * Calls `visit` for every key of a family that names an element, in file order. A key with no
 * index or no leaf, an index text the parse refuses, and an index stored negative name none. A
 * callback, not a list: `indexedElements` runs on every parse, and a family of 200,000 keys would
 * allocate a record per key only to group it.
 */
function visitIndexedKeys(
  properties: Readonly<Record<string, string>>,
  prefix: string,
  indexParse: IndexParse,
  visit: (key: string, indexText: string, index: number, leaf: string, value: string) => void
): void {
  for (const key of Object.keys(properties)) {
    if (!key.startsWith(prefix)) continue;
    // The split follows the parse. `PropertyListHelper` does `rsplit("/", true, 1)`
    // (`property_list_helper.cpp:47`), so the leaf is one segment. A hand-rolled `_set` counts
    // `get_slicec('/', n)` from the left, so a nested family's leaf (`joints/1/bone`) is the rest.
    const slash =
      indexParse === 'is_valid_int' ? key.lastIndexOf('/') : key.indexOf('/', prefix.length);
    if (slash < prefix.length) continue;
    const indexText = key.slice(prefix.length, slash);
    const leaf = key.slice(slash + 1);
    if (indexText === '' || leaf === '') continue;
    // `layer_9/tile_data/x` gives the index text `9/tile_data`, so `_set` builds no layer 9.
    if (indexParse === 'is_valid_int' && !IS_VALID_INT_RE.test(indexText)) continue;
    const index = stringToInt(indexText);
    // A negative index never lands: `_get_property` refuses it (`property_list_helper.cpp:58`) and
    // each hand-rolled `_set` has its own `ERR_FAIL_INDEX_V`, which phase 1 reports.
    if (index < 0) continue;
    visit(key, indexText, index, leaf, properties[key]!);
  }
}

/** Every key of a family that names an element, in file order, resolved as Godot resolves it. */
export function indexedKeys(
  properties: Readonly<Record<string, string>>,
  prefix: string,
  indexParse: IndexParse
): IndexedKey[] {
  const keys: IndexedKey[] = [];
  visitIndexedKeys(properties, prefix, indexParse, (key, indexText, index, leaf, value) => {
    keys.push({ key, indexText, index, leaf, value });
  });
  return keys;
}

/**
 * A family's keys grouped by the element Godot applies them to, leaf name to raw value. Two
 * spellings can name one element (`settings/00/x` and `settings/0/x`), so a lookup built from
 * `0..count` misses values and a text-keyed one splits an element. A `Map`: the leaf is raw
 * `.tscn` text, and `__proto__` or `constructor` would reach an object's prototype.
 */
export function indexedElements(
  properties: Readonly<Record<string, string>>,
  prefix: string,
  indexParse: IndexParse
): Map<number, Map<string, string>> {
  const elements = new Map<number, Map<string, string>>();
  visitIndexedKeys(properties, prefix, indexParse, (_key, _indexText, index, leaf, value) => {
    const leaves = elements.get(index) ?? new Map<string, string>();
    // A later key wins, as Godot applies properties in file order.
    leaves.set(leaf, value);
    elements.set(index, leaves);
  });
  return elements;
}
