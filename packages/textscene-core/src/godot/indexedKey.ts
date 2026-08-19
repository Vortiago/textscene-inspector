/** How Godot resolves an indexed property key — `item_0/text`, `settings/2/joints/1/bone`. */

import { IS_VALID_INT_RE, IS_VALID_INT_SOURCE, toIntIndex } from './string.js';

/**
 * Which of Godot's TWO index resolutions a class uses. The same union
 * `indexedFamilyValidator`'s `indexParse` option takes, because it is the same
 * per-family engine fact and phase 1 and phase 2 must never answer it
 * differently for one class.
 *
 * - `'is_valid_int'` — `PropertyListHelper::_get_property` gates on
 *   `String::is_valid_int()` BEFORE converting (`property_list_helper.cpp:53-55`),
 *   so text the gate rejects yields no index at all and `_set` returns false.
 * - `'to_int'` — a class that builds its own property list reads the index with
 *   a bare `path.get_slicec('/', n).to_int()` and no gate
 *   (`bone_twist_disperser_3d.cpp:37`), and `to_int` resolves ANY text to a
 *   number, so every segment names some element.
 */
export type IndexParse = 'is_valid_int' | 'to_int';

/**
 * The text each parse admits at an index position, as regex source.
 *
 * `is_valid_int` is the body of {@link IS_VALID_INT_RE} — ONE optional sign,
 * `+` as readily as `-` (`ustring.cpp:4752`), then digits to the end. A rule
 * writing `-?\d+` instead missed `item_+5/text`, a key Godot resolves.
 *
 * `to_int` is the whole path SEGMENT, because there is nothing for a grammar to
 * refuse: `to_int` skips a character it cannot use rather than stopping at it
 * (`ustring.cpp:2280-2293`), so `settings/x/…` names setting 0. The number is
 * the READER's answer, not the grammar's — see {@link toIntIndex}.
 *
 * A segment is non-empty here, matching `indexedFamilyValidator`, so
 * `settings//leaf` reaches neither phase and only one voice can report it.
 */
const INDEX_SOURCE: Readonly<Record<IndexParse, string>> = {
  is_valid_int: `(?:${IS_VALID_INT_SOURCE})`,
  to_int: '(?:[^/]+)',
};

/**
 * The grammar of one indexed key shape, with `#` standing for an index position.
 *
 * `shape` is regex source: anchor it, spell the literal prefix and leaf as they
 * appear, and write `(#)` where the index should be captured, `#` where it
 * should only be matched. Nothing else about the shape is special-cased, so a
 * nested index (`^settings/(#)/joints/(#)/twist_amount$`) and an index that
 * terminates the key (`^collisions/#$`) both express directly.
 *
 * A builder rather than an exported pattern string, because a pattern each rule
 * interpolates into its own `new RegExp` leaves the escaping and the anchoring
 * at eleven call sites and the grammar shared only by convention. This leaves
 * the digit class in one file, which is the invariant
 * `indexedKeyGrammar.guard.test.ts` can then state absolutely.
 */
export function indexedKeyRegex(shape: string, indexParse: IndexParse): RegExp {
  return new RegExp(shape.replaceAll('#', INDEX_SOURCE[indexParse]));
}

/**
 * A family's keys grouped by the element Godot APPLIES them to, leaf name to
 * raw value.
 *
 * The reverse of the shape a rule reaches for by default — walking `0..count`
 * and reading `props[`settings/${i}/leaf`]` — and the fix for what that shape
 * cannot see. Two keys spelled differently can name one element
 * (`settings/00/x` and `settings/0/x` are both setting 0 under `to_int`, as are
 * `item_5/text` and `item_+5/text` under `is_valid_int`), so a forward-built
 * lookup misses a value the engine applied and a text-keyed one splits one
 * element into two.
 *
 * The leaf is EVERYTHING below the index, so a nested family
 * (`settings/0/joints/1/bone`) comes back under `joints/1/bone` for the caller
 * to resolve in turn, exactly as `indexedFamilyValidator` splits it.
 *
 * Negative indices are absent: `_get_property` refuses one
 * (`property_list_helper.cpp:58`) and every hand-rolled `_set` has its own
 * `ERR_FAIL_INDEX_V` beside the parse, so the write never lands, and phase 1
 * already reports it. A later key wins, because `Object.keys` keeps insertion
 * order and Godot applies properties in file order too.
 */
export function indexedElements(
  properties: Readonly<Record<string, string>>,
  prefix: string,
  indexParse: IndexParse
): Map<number, Record<string, string>> {
  const elements = new Map<number, Record<string, string>>();
  for (const [key, value] of Object.entries(properties)) {
    if (!key.startsWith(prefix)) continue;
    const slash = key.indexOf('/', prefix.length);
    if (slash < 0) continue;
    const indexText = key.slice(prefix.length, slash);
    const leaf = key.slice(slash + 1);
    if (indexText === '' || leaf === '') continue;
    if (indexParse === 'is_valid_int' && !IS_VALID_INT_RE.test(indexText)) continue;
    const index = toIntIndex(indexText);
    // NaN for a magnitude no double names exactly; every comparison against it
    // is false, so admitting it would seat an element under a wrong key.
    if (!(index >= 0)) continue;
    const leaves = elements.get(index) ?? {};
    leaves[leaf] = value;
    elements.set(index, leaves);
  }
  return elements;
}
