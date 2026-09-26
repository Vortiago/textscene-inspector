/**
 * The own contracts of `visitIndexedKeys` and `indexedElements`, around the module every rule
 * resolves an index through. The slices' `linter.test.ts` files test the rules that use them.
 */

import { describe, expect, it } from 'vitest';
import {
  declaredLeafResolver,
  firstSegment,
  indexedElements,
  visitIndexedKeys,
} from './indexedKey.js';

/** A class that declares no leaf, so every leaf keeps its own text. */
const NO_DECLARED_LEAVES = declaredLeafResolver([]);

/** Every visit `visitIndexedKeys` makes, as its five arguments. */
function visits(
  properties: Record<string, string>,
  prefix: string,
  indexParse: 'is_valid_int' | 'to_int'
): unknown[][] {
  const seen: unknown[][] = [];
  visitIndexedKeys(properties, prefix, indexParse, (...args) => seen.push(args));
  return seen;
}

describe('visitIndexedKeys', () => {
  it('visits each key that names an element, in file order, with the index Godot stores', () => {
    expect(visits({ 'item_1/text': '"a"', 'item_+0/icon': 'null' }, 'item_', 'is_valid_int')).toEqual([
      ['item_1/text', '1', 1, 'text', '"a"'],
      ['item_+0/icon', '+0', 0, 'icon', 'null'],
    ]);
  });

  it('visits no key whose index is refused or stored negative', () => {
    expect(visits({ 'item_x/text': '"a"', 'item_-1/text': '"b"' }, 'item_', 'is_valid_int')).toEqual([]);
  });

  it('visits nothing for a family with no keys', () => {
    expect(visits({ text: '"a"' }, 'item_', 'is_valid_int')).toEqual([]);
  });

  it('visits no key with no leaf', () => {
    expect(visits({ 'item_3/': '"a"' }, 'item_', 'is_valid_int')).toEqual([]);
  });

  it('visits no key whose last slash puts a slash in the index text', () => {
    // `rsplit("/", true, 1)` (property_list_helper.cpp:47) makes the index text `5/x`.
    expect(visits({ 'item_5/x/text': '"a"' }, 'item_', 'is_valid_int')).toEqual([]);
  });

  // `int index = ….to_int()` (property_list_helper.cpp:57) keeps the low 32 bits.
  it('applies an index that wraps past 32 bits to the element it lands on', () => {
    expect(visits({ 'item_4294967296/text': '"a"' }, 'item_', 'is_valid_int')).toEqual([
      ['item_4294967296/text', '4294967296', 0, 'text', '"a"'],
    ]);
  });

  // `to_int` saturates at INT64_MAX (ustring.cpp:2283-2284), whose low 32 bits are -1.
  it('visits no index that saturates to INT64_MAX', () => {
    expect(visits({ 'item_9999999999999999999999/text': '"a"' }, 'item_', 'is_valid_int')).toEqual(
      []
    );
  });

  // INT64_MIN keeps 0 in its low 32 bits, so the write lands on element 0.
  it('applies an index that saturates to INT64_MIN to element 0', () => {
    const [visit] = visits({ 'item_-9999999999999999999999/text': '"a"' }, 'item_', 'is_valid_int');
    expect(visit?.slice(1, 3)).toEqual(['-9999999999999999999999', 0]);
  });
});

describe('indexedElements', () => {
  it('seats two spellings of one index on one element, under to_int', () => {
    // `settings/00/…` and `settings/0/…` both `to_int` to 0
    // (ustring.cpp:2303-2311), so the engine applies them to one setting.
    const elements = indexedElements(
      { 'settings/0/individual_config': 'true', 'settings/00/radius/value': '0.5' },
      'settings/',
      'to_int',
      NO_DECLARED_LEAVES
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
      'to_int',
      NO_DECLARED_LEAVES
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
    expect(
      indexedElements({ 'settings/a-1/bone': '"A"' }, 'settings/', 'to_int', NO_DECLARED_LEAVES)
        .size
    ).toBe(0);
  });

  it('keeps the whole path below the index as the leaf', () => {
    // The index ends at the first `/`, so a nested family comes back for the
    // caller to resolve in turn rather than collapsing into no leaf at all.
    const elements = indexedElements(
      { 'settings/0/joints/1/bone': '"A"' },
      'settings/',
      'to_int',
      NO_DECLARED_LEAVES
    );
    expect([...elements.get(0)!]).toEqual([['joints/1/bone', '"A"']]);
  });

  it('ignores a key with no leaf below the index, and one with no index', () => {
    const elements = indexedElements(
      { setting_count: '2', 'settings/0': 'x', 'settings//bone': '"A"' },
      'settings/',
      'to_int',
      NO_DECLARED_LEAVES
    );
    expect(elements.size).toBe(0);
  });

  it('lets a later key win, the way Godot applies properties in file order', () => {
    const elements = indexedElements(
      { 'settings/0/bone': '"First"', 'settings/00/bone': '"Second"' },
      'settings/',
      'to_int',
      NO_DECLARED_LEAVES
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
      ...indexedElements(
        { 'settings/0/joints/1/bone': '2' },
        'settings/',
        'to_int',
        NO_DECLARED_LEAVES
      ).get(0)!,
    ]).toEqual([['joints/1/bone', '2']]);
  });

  it('keeps a leaf named __proto__, which an object literal swallowed', () => {
    // The leaf is raw `.tscn` text. Assigned onto an object literal it would invoke
    // `Object.prototype`'s setter, so the authored write would vanish.
    const elements = indexedElements(
      { 'settings/0/__proto__': '"polluted"' },
      'settings/',
      'to_int',
      NO_DECLARED_LEAVES
    );
    expect(elements.get(0)?.get('__proto__')).toBe('"polluted"');
    expect([...elements.get(0)!.keys()]).toEqual(['__proto__']);
  });

  it('answers undefined for a prototype-named leaf nothing wrote', () => {
    // On an object literal `leaves.constructor` and `leaves.toString` answer with a function out
    // of a value typed as a string.
    const elements = indexedElements(
      { 'settings/0/bone': '"A"' },
      'settings/',
      'to_int',
      NO_DECLARED_LEAVES
    );
    const leaves = elements.get(0)!;
    for (const name of ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__']) {
      expect(leaves.get(name)).toBeUndefined();
    }
  });
});

describe('declaredLeafResolver', () => {
  // SpringBoneSimulator3D's shape: `end_bone` reads an option below itself
  // (spring_bone_simulator_3d.cpp:52-62), and `radius` is declared only through its options.
  const resolve = declaredLeafResolver([
    'root_bone',
    'end_bone',
    'end_bone/direction',
    'radius/value',
  ]);

  it('resolves a declared leaf to itself', () => {
    expect(resolve('root_bone')).toBe('root_bone');
    expect(resolve('end_bone/direction')).toBe('end_bone/direction');
  });

  it('drops a tail below a terminal leaf, which get_slicec never reads', () => {
    expect(resolve('root_bone/extra')).toBe('root_bone');
    expect(resolve('root_bone/a/b')).toBe('root_bone');
    expect(resolve('radius/value/extra')).toBe('radius/value');
    expect(resolve('end_bone/direction/extra')).toBe('end_bone/direction');
  });

  it('resolves nothing below a leaf whose branch reads an option there', () => {
    // The branch compares that segment and returns false on one it does not know.
    expect(resolve('end_bone/extra')).toBeNull();
  });

  it('resolves nothing for a path no declared leaf starts', () => {
    expect(resolve('not_a_leaf')).toBeNull();
    expect(resolve('radius')).toBeNull();
    expect(resolve('radius/extra')).toBeNull();
    // A segment prefix, not a string prefix: `root_bone_name` is another branch.
    expect(resolve('root_bone_name')).toBeNull();
  });

  it('resolves nothing below a first segment no declared leaf starts', () => {
    expect(resolve('joints/0/radius')).toBeNull();
    expect(resolve('/root_bone')).toBeNull();
  });

  it('resolves nothing for a prototype name', () => {
    expect(resolve('toString')).toBeNull();
    expect(resolve('constructor/extra')).toBeNull();
  });
});

describe('firstSegment', () => {
  it('returns the text before the first slash', () => {
    expect(firstSegment('apply/transform_mode')).toBe('apply');
    expect(firstSegment('joints/0/bone')).toBe('joints');
  });

  it('returns the whole path when it has no slash', () => {
    expect(firstSegment('root_bone')).toBe('root_bone');
    expect(firstSegment('')).toBe('');
  });

  it('returns an empty segment for a leading slash', () => {
    expect(firstSegment('/root_bone')).toBe('');
  });
});

describe('indexedElements with a leaf resolver', () => {
  it('requires a resolver for a to_int family and takes none for is_valid_int', () => {
    // A type contract, held by `type-check:tests`: a hand-rolled `_set` ignores a tail, so a
    // `to_int` caller that forgot the resolver would split `x/extra` from `x`.
    // @ts-expect-error: a to_int family must say which leaves it declares.
    indexedElements({}, 'settings/', 'to_int');
    // @ts-expect-error: `PropertyListHelper` reads one exact segment, so it takes no resolver.
    indexedElements({}, 'item_', 'is_valid_int', NO_DECLARED_LEAVES);
    expect(indexedElements({}, 'item_', 'is_valid_int').size).toBe(0);
  });

  const resolve = declaredLeafResolver(['individual_config', 'radius/value']);

  it('seats a key carrying a tail on the leaf _set applies it to', () => {
    const elements = indexedElements(
      { 'settings/0/individual_config/extra': 'true' },
      'settings/',
      'to_int',
      resolve
    );
    expect(elements.get(0)?.get('individual_config')).toBe('true');
  });

  it('keeps the text of a leaf that resolves to nothing', () => {
    const elements = indexedElements(
      { 'settings/0/joints/0/radius': '0.5' },
      'settings/',
      'to_int',
      resolve
    );
    expect(elements.get(0)?.get('joints/0/radius')).toBe('0.5');
  });

  it('lets the later of two spellings of one leaf win, in file order', () => {
    const elements = indexedElements(
      { 'settings/0/individual_config': 'false', 'settings/0/individual_config/x': 'true' },
      'settings/',
      'to_int',
      resolve
    );
    expect(elements.get(0)?.get('individual_config')).toBe('true');
  });
});
