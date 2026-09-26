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

/**
 * Calls `visit` for every key of a family that names an element, in file order, with the `int` Godot
 * stores as `index` ({@link stringToInt}): `5`, `+5` and `05` all name element 5. A key with no index
 * or no leaf, a refused index text and a negative index name none. A callback, not a list: a caller
 * that filters would otherwise allocate a record per key of a 200,000-key family only to drop it.
 */
export function visitIndexedKeys(
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

/** The declared leaf a path below an index reaches, or null. See {@link declaredLeafResolver}. */
export type LeafResolver = (leafName: string) => string | null;

/**
 * A family's keys grouped by the element Godot applies them to, leaf name to raw value. Two
 * spellings can name one element (`settings/00/x` and `settings/0/x`), so a lookup built from
 * `0..count` misses values and a text-keyed one splits an element. A `Map`: the leaf is raw
 * `.tscn` text, and `__proto__` or `constructor` would reach an object's prototype.
 * A `to_int` family is a hand-rolled `_set`, which ignores a tail below the segment it reads, so it
 * takes the class's resolver and seats `x/extra` on `x`. A leaf that resolves to nothing keeps its
 * own text.
 */
export function indexedElements<P extends IndexParse>(
  properties: Readonly<Record<string, string>>,
  prefix: string,
  indexParse: P,
  ...leafResolver: P extends 'to_int' ? [LeafResolver] : []
): Map<number, Map<string, string>> {
  const [resolveLeaf] = leafResolver as [LeafResolver?];
  const elements = new Map<number, Map<string, string>>();
  visitIndexedKeys(properties, prefix, indexParse, (_key, _indexText, index, leaf, value) => {
    const leaves = elements.get(index) ?? new Map<string, string>();
    // A later key wins, as Godot applies properties in file order.
    leaves.set(resolveLeaf?.(leaf) ?? leaf, value);
    elements.set(index, leaves);
  });
  return elements;
}

/**
 * The declared leaf a hand-rolled `_set` applies a path below the index to. Each branch reads one
 * `get_slicec('/', n)` and ignores what follows, so `settings/0/root_bone/extra` calls
 * `set_root_bone` (bone_twist_disperser_3d.cpp:37-40). A branch that reads an option below itself
 * (`end_bone`, beside `end_bone/direction`) returns false on one it does not know
 * (two_bone_ik_3d.cpp:69), so only a terminal leaf swallows a tail. Nothing, not the path itself,
 * for a path that reaches no declared leaf.
 */
export function declaredLeafResolver(leafNames: Iterable<string>): LeafResolver {
  // A Set, not an object: a leaf named `toString` must not resolve an inherited member.
  const declared = new Set(leafNames);
  const readsDeeper = new Set<string>();
  const firstSegments = new Set<string>();
  for (const name of declared) {
    firstSegments.add(firstSegment(name));
    for (let cut = name.indexOf('/'); cut >= 0; cut = name.indexOf('/', cut + 1)) {
      readsDeeper.add(name.slice(0, cut));
    }
  }
  return (leafName) => {
    if (declared.has(leafName)) return leafName;
    // Every branch tests the first segment, so a path no declared leaf starts is a miss without
    // cutting: a family's nested `joints/<j>/…` keys, most of a large one, end here.
    if (!firstSegments.has(firstSegment(leafName))) return null;
    // Cutting from the right keeps a two-segment leaf at its own depth
    // (`settings/<i>/<where>/<what>`, convert_transform_modifier_3d.cpp:37-40).
    let candidate = leafName;
    for (let cut = candidate.lastIndexOf('/'); cut >= 0; cut = candidate.lastIndexOf('/')) {
      candidate = candidate.slice(0, cut);
      if (declared.has(candidate) && !readsDeeper.has(candidate)) return candidate;
    }
    return null;
  };
}

/** The text before the first `/`, or all of it: the `what` a hand-rolled `_set` tests. */
export function firstSegment(path: string): string {
  const slash = path.indexOf('/');
  return slash < 0 ? path : path.slice(0, slash);
}
