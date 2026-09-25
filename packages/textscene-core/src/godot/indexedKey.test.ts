/**
 * `indexedKeys`' and `indexedElements`' own contracts, around the module every rule resolves an
 * index through. The slices' `linter.test.ts` files test the rules that use them.
 */

import { describe, expect, it } from 'vitest';
import { indexedElements, indexedKeys } from './indexedKey.js';

describe('indexedKeys', () => {
  it('keeps the whole key, the index text, the leaf and the value as written', () => {
    expect(indexedKeys({ 'item_+2/text': '"Save"' }, 'item_', 'is_valid_int')).toEqual([
      { key: 'item_+2/text', indexText: '+2', index: 2, leaf: 'text', value: '"Save"' },
    ]);
  });

  it('lists the keys in file order', () => {
    const keys = indexedKeys({ 'item_1/text': '"a"', 'item_0/text': '"b"' }, 'item_', 'is_valid_int');
    expect(keys.map(({ key }) => key)).toEqual(['item_1/text', 'item_0/text']);
  });

  it('leaves out an index text is_valid_int refuses', () => {
    // `_get_property` returns null unless the index `is_valid_int()`
    // (property_list_helper.cpp:53-55).
    expect(indexedKeys({ 'item_x/text': '"a"' }, 'item_', 'is_valid_int')).toEqual([]);
  });

  it('leaves out an index stored negative', () => {
    // `_get_property` refuses `index < 0` (property_list_helper.cpp:58).
    expect(indexedKeys({ 'item_-1/text': '"a"' }, 'item_', 'is_valid_int')).toEqual([]);
  });

  it('leaves out a key with no leaf', () => {
    expect(indexedKeys({ 'item_3/': '"a"' }, 'item_', 'is_valid_int')).toEqual([]);
  });

  it('leaves out a key whose last slash puts a slash in the index text', () => {
    // `rsplit("/", true, 1)` (property_list_helper.cpp:47) makes the index text `5/x`.
    expect(indexedKeys({ 'item_5/x/text': '"a"' }, 'item_', 'is_valid_int')).toEqual([]);
  });

  // `int index = ….to_int()` (property_list_helper.cpp:57) keeps the low 32 bits.
  it('applies an index that wraps past 32 bits to the element it lands on', () => {
    const [key] = indexedKeys({ 'item_4294967296/text': '"a"' }, 'item_', 'is_valid_int');
    expect(key).toMatchObject({ indexText: '4294967296', index: 0 });
  });

  // `to_int` saturates at INT64_MAX (ustring.cpp:2283-2284), whose low 32 bits are -1.
  it('leaves out an index that saturates to INT64_MAX', () => {
    expect(
      indexedKeys({ 'item_9999999999999999999999/text': '"a"' }, 'item_', 'is_valid_int')
    ).toEqual([]);
  });

  // INT64_MIN keeps 0 in its low 32 bits, so the write lands on element 0.
  it('applies an index that saturates to INT64_MIN to element 0', () => {
    const [key] = indexedKeys(
      { 'item_-9999999999999999999999/text': '"a"' },
      'item_',
      'is_valid_int'
    );
    expect(key).toMatchObject({ indexText: '-9999999999999999999999', index: 0 });
  });
});

describe('indexedElements', () => {
  it('seats two spellings of one index on one element, under to_int', () => {
    // `settings/00/…` and `settings/0/…` both `to_int` to 0
    // (ustring.cpp:2303-2311), so the engine applies them to one setting.
    const elements = indexedElements(
      { 'settings/0/individual_config': 'true', 'settings/00/radius/value': '0.5' },
      'settings/',
      'to_int'
    );
    expect([...elements.keys()]).toEqual([0]);
    expect([...elements.get(0)!]).toEqual([
      ['individual_config', 'true'],
      ['radius/value', '0.5'],
    ]);
  });

  it('resolves a non-numeric index the way to_int does', () => {
    // `to_int` skips a character it cannot use rather than stopping at it
    // (ustring.cpp:2280-2293), so `x1` is 1 and `x` is 0.
    const elements = indexedElements(
      { 'settings/x1/bone': '"A"', 'settings/x/bone': '"B"' },
      'settings/',
      'to_int'
    );
    expect([...elements.keys()].sort()).toEqual([0, 1]);
  });

  it('refuses a non-numeric index under is_valid_int, where no index resolves', () => {
    // `_get_property` returns null unless the index `is_valid_int()`
    // (property_list_helper.cpp:53-55), so the write is dropped entirely.
    const elements = indexedElements(
      { 'item_x/text': '"Open"', 'item_+2/text': '"Save"' },
      'item_',
      'is_valid_int'
    );
    // `+2` is a real spelling: `is_valid_int` skips one leading sign, `+` as
    // readily as `-` (ustring.cpp:4752).
    expect([...elements.keys()]).toEqual([2]);
  });

  it('drops a negative index, which neither parse ever applies', () => {
    // `_get_property` returns null for `index < 0`
    // (property_list_helper.cpp:58), and every hand-rolled `_set` has its own
    // `ERR_FAIL_INDEX_V` beside the parse.
    expect(indexedElements({ 'item_-1/text': '"Open"' }, 'item_', 'is_valid_int').size).toBe(0);
    expect(indexedElements({ 'settings/a-1/bone': '"A"' }, 'settings/', 'to_int').size).toBe(0);
  });

  it('keeps the whole path below the index as the leaf', () => {
    // The index ends at the first `/`, so a nested family comes back for the
    // caller to resolve in turn rather than collapsing into no leaf at all.
    const elements = indexedElements(
      { 'settings/0/joints/1/bone': '"A"' },
      'settings/',
      'to_int'
    );
    expect([...elements.get(0)!]).toEqual([['joints/1/bone', '"A"']]);
  });

  it('ignores a key with no leaf below the index, and one with no index', () => {
    const elements = indexedElements(
      { setting_count: '2', 'settings/0': 'x', 'settings//bone': '"A"' },
      'settings/',
      'to_int'
    );
    expect(elements.size).toBe(0);
  });

  it('lets a later key win, the way Godot applies properties in file order', () => {
    const elements = indexedElements(
      { 'settings/0/bone': '"First"', 'settings/00/bone': '"Second"' },
      'settings/',
      'to_int'
    );
    expect(elements.get(0)?.get('bone')).toBe('"Second"');
  });

  it('seats no element for a multi-slash key under is_valid_int', () => {
    // `_get_property` rsplits at the last `/` and gates everything above it on
    // `is_valid_int` (property_list_helper.cpp:47-53), so the index text here is
    // `9/tile_data` and no layer 9 is ever built.
    expect([...indexedElements({ 'layer_9/tile_data/x': '1' }, 'layer_', 'is_valid_int')]).toEqual(
      []
    );
  });

  it('still nests a to_int family, whose leaf is everything below the index', () => {
    expect([
      ...indexedElements({ 'settings/0/joints/1/bone': '2' }, 'settings/', 'to_int').get(0)!,
    ]).toEqual([['joints/1/bone', '2']]);
  });

  it('keeps a leaf named __proto__, which an object literal swallowed', () => {
    // The leaf is raw `.tscn` text. Assigned onto an object literal it would invoke
    // `Object.prototype`'s setter, so the authored write would vanish.
    const elements = indexedElements(
      { 'settings/0/__proto__': '"polluted"' },
      'settings/',
      'to_int'
    );
    expect(elements.get(0)?.get('__proto__')).toBe('"polluted"');
    expect([...elements.get(0)!.keys()]).toEqual(['__proto__']);
  });

  it('answers undefined for a prototype-named leaf nothing wrote', () => {
    // On an object literal `leaves.constructor` and `leaves.toString` answer with a function out
    // of a value typed as a string.
    const elements = indexedElements({ 'settings/0/bone': '"A"' }, 'settings/', 'to_int');
    const leaves = elements.get(0)!;
    for (const name of ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__']) {
      expect(leaves.get(name)).toBeUndefined();
    }
  });
});
