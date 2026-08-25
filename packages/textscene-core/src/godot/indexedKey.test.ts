/**
 * `indexedElements`' own contract, as a fence around the module every rule now
 * resolves an index through. The red-green tests for the defects that produced
 * it are in the slices: the eleven `linter.test.ts` files whose rules resolve
 * an index through this module.
 */

import { describe, expect, it } from 'vitest';
import { indexedElements } from './indexedKey.js';

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
    expect(elements.get(0)).toEqual({ individual_config: 'true', 'radius/value': '0.5' });
  });

  it('resolves a non-numeric index the way to_int does', () => {
    // `to_int` SKIPS a character it cannot use rather than stopping at it
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
    // `+2` is a real spelling: `is_valid_int` skips ONE leading sign, `+` as
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
    // The index ends at the FIRST `/`, so a nested family comes back for the
    // caller to resolve in turn rather than collapsing into no leaf at all.
    const elements = indexedElements(
      { 'settings/0/joints/1/bone': '"A"' },
      'settings/',
      'to_int'
    );
    expect(elements.get(0)).toEqual({ 'joints/1/bone': '"A"' });
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
    expect(elements.get(0)?.bone).toBe('"Second"');
  });

  it('seats no element for a multi-slash key under is_valid_int', () => {
    // `_get_property` rsplits at the LAST `/` and gates everything above it on
    // `is_valid_int` (property_list_helper.cpp:47-53), so the index text here is
    // `9/tile_data` and no layer 9 is ever built.
    expect([...indexedElements({ 'layer_9/tile_data/x': '1' }, 'layer_', 'is_valid_int')]).toEqual(
      []
    );
  });

  it('still nests a to_int family, whose leaf is everything below the index', () => {
    expect(
      indexedElements({ 'settings/0/joints/1/bone': '2' }, 'settings/', 'to_int').get(0)
    ).toEqual({ 'joints/1/bone': '2' });
  });
});
