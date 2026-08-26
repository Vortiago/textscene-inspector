/**
 * `indexedFamilyValidator`: the shared parse for Godot's indexed property
 * families, including the NESTED leaf that four Godot classes serialise.
 *
 * The leaf-depth cases are the reason this file exists. Before them the
 * dispatcher split at the LAST `/` and required everything between the prefix
 * and that slash to be digits, so `settings/0/apply/transform_mode` read an
 * index of `0/apply`, failed the integer test and came back as an unknown
 * property. Three slices hand-rolled an outer dispatcher around that, and a
 * fourth (ConvertTransformModifier3D, eight nested leaves) made it worth
 * fixing once.
 */

import { describe, expect, it, vi } from 'vitest';
import { indexedFamilyValidator } from './indexedFamily.js';
import { v } from './v.js';
import type { PropertyValidator } from '../ValidatorRegistry.js';

/** A leaf that records being reached, so a test can assert routing, not just a verdict. */
function probe(): PropertyValidator & { calls: string[] } {
  const calls: string[] = [];
  const validator: PropertyValidator = (key) => {
    calls.push(key);
    return null;
  };
  validator.formatOnly = true;
  return Object.assign(validator, { calls });
}

describe('indexedFamilyValidator', () => {
  describe('a single-segment leaf', () => {
    const leaf = probe();
    const family = indexedFamilyValidator({
      prefix: 'item_',
      leaves: { text: leaf },
      unknownCode: 'INVALID_ITEM',
      describes: 'item',
    });

    it('routes the glued-index shape to its leaf', () => {
      expect(family('item_3/text', '"hi"', 1)).toBeNull();
      expect(leaf.calls).toContain('item_3/text');
    });

    it('rejects a leaf name the family does not declare', () => {
      const error = family('item_0/nope', '1', 7);
      expect(error?.code).toBe('INVALID_ITEM');
      expect(error?.message).toContain('item_0/nope');
    });

    it('rejects a non-integer index, the default is_valid_int parse', () => {
      expect(family('item_x/text', '"hi"', 1)?.code).toBe('INVALID_ITEM');
    });

    it('rejects a key with no leaf at all', () => {
      expect(family('item_0/', '1', 1)?.code).toBe('INVALID_ITEM');
      expect(family('item_0', '1', 1)?.code).toBe('INVALID_ITEM');
    });

    it('rejects a key that does not carry the prefix', () => {
      expect(family('other_0/text', '"hi"', 1)?.code).toBe('INVALID_ITEM');
    });
  });

  describe('a nested leaf', () => {
    const nested = probe();
    const flat = probe();
    const family = indexedFamilyValidator({
      prefix: 'settings/',
      leaves: {
        // The `apply_bone` / `apply/axis` pair is the real collision: one class
        // contributes a flat leaf whose name is a prefix of another class's
        // nested group, and the split must not confuse them.
        'apply/axis': nested,
        apply_bone: flat,
      },
      unknownCode: 'INVALID_SETTING',
      describes: 'setting',
    });

    it('routes a two-segment leaf to its validator', () => {
      expect(family('settings/0/apply/axis', '1', 1)).toBeNull();
      expect(nested.calls).toContain('settings/0/apply/axis');
    });

    it('keeps a flat leaf whose name merely starts like a nested group apart', () => {
      expect(family('settings/0/apply_bone', '2', 1)).toBeNull();
      expect(flat.calls).toEqual(['settings/0/apply_bone']);
      expect(nested.calls).not.toContain('settings/0/apply_bone');
    });

    it('reports the WHOLE key when a nested leaf is unrecognised', () => {
      // The last segment alone is ambiguous once leaves are nested: `axis`
      // appears under both `apply/` and `reference/`.
      const error = family('settings/0/apply/nope', '1', 4);
      expect(error?.code).toBe('INVALID_SETTING');
      expect(error?.message).toContain('settings/0/apply/nope');
    });

    it('parses the index from the FIRST slash, so a nested key is still indexed', () => {
      // A last-slash split reads `0/apply` here, which is not an integer, so the
      // whole key falls through to no validator at all.
      const error = family('settings/-1/apply/axis', '1', 1);
      expect(error?.code).toBe('INVALID_SETTING');
      expect(nested.calls).not.toContain('settings/-1/apply/axis');
    });

    it('routes an arbitrarily deep leaf name it declares', () => {
      const deep = probe();
      const deepFamily = indexedFamilyValidator({
        prefix: 'settings/',
        leaves: { 'a/b/c': deep },
        unknownCode: 'INVALID_SETTING',
        describes: 'setting',
      });
      expect(deepFamily('settings/2/a/b/c', '1', 1)).toBeNull();
      expect(deep.calls).toEqual(['settings/2/a/b/c']);
    });
  });

  describe("indexParse: 'to_int', the hand-rolled _set parse", () => {
    const leaf = probe();
    const family = indexedFamilyValidator({
      prefix: 'settings/',
      leaves: { relative: leaf },
      unknownCode: 'INVALID_SETTING',
      describes: 'setting',
      indexParse: 'to_int',
      negativeIndex: {
        cite: 'some_file.cpp:39',
        code: 'INVALID_SETTING_INDEX',
        message: (index) => `index ${index} is refused`,
      },
    });

    it('accepts a non-numeric index, because to_int resolves it and the write lands', () => {
      // `_to_int` skips non-digits rather than stopping at them
      // (ustring.cpp:2268-2298), so "x".to_int() is 0 and `set_relative(0, …)`
      // really runs. Nothing refuses the value, so ADR-0032 grounds nothing.
      expect(family('settings/x/relative', 'true', 1)).toBeNull();
      expect(leaf.calls).toContain('settings/x/relative');
    });

    it('still rejects an unknown leaf under a non-numeric index', () => {
      // The index resolves, but `_set` falls to its `return false` for a leaf
      // it does not name, so THAT write is dropped.
      expect(family('settings/x/made_up', 'true', 1)?.code).toBe('INVALID_SETTING');
    });

    it('still errors on a negative index, which ERR_FAIL_INDEX refuses', () => {
      expect(family('settings/-1/relative', 'true', 1)?.code).toBe('INVALID_SETTING_INDEX');
    });

    it('errors on a negative index reached through a non-digit, which to_int resolves', () => {
      // `to_int` flips the sign on a `-` seen while the total is still 0
      // (ustring.cpp:2291-2292) and skips the letter entirely, so "a-1" is -1
      // and ERR_FAIL_INDEX_V refuses the write exactly as it does for "-1".
      expect(family('settings/a-1/relative', 'true', 1)?.code).toBe('INVALID_SETTING_INDEX');
    });

    it('keeps accepting a non-digit index that resolves non-negative', () => {
      // "-0-1" is 1, not -1: the `0` leaves the total at 0 so the second `-`
      // flips the sign back. The write lands, so nothing is refused.
      expect(family('settings/-0-1/relative', 'true', 1)).toBeNull();
    });

    it('still rejects a key with no index segment at all', () => {
      expect(family('settings/relative', 'true', 1)?.code).toBe('INVALID_SETTING');
    });
  });

  describe('the negative-index branch', () => {
    const family = indexedFamilyValidator({
      prefix: 'settings/',
      leaves: { 'apply/axis': probe() },
      unknownCode: 'INVALID_SETTING',
      describes: 'setting',
      negativeIndex: {
        cite: 'some_file.cpp:39',
        code: 'INVALID_SETTING_INDEX',
        message: (index) => `index ${index} is refused`,
      },
    });

    it('fires for a nested leaf too, not only a flat one', () => {
      const error = family('settings/-1/apply/axis', '1', 1);
      expect(error?.code).toBe('INVALID_SETTING_INDEX');
      expect(error?.message).toContain('index -1 is refused');
    });

    it('is an ENFORCED grounding, since the write really is dropped', () => {
      expect(family.grounding).toEqual({ kind: 'enforced', cite: 'some_file.cpp:39' });
      expect(family.formatOnly).toBeUndefined();
    });
  });

  describe('grounding tags', () => {
    it('is format-only without a negative-index branch, since only shapes are refused', () => {
      const family = indexedFamilyValidator({
        prefix: 'settings/',
        leaves: { relative: v.boolean('relative') },
        unknownCode: 'INVALID_SETTING',
        describes: 'setting',
      });
      expect(family.formatOnly).toBe(true);
      expect(family.grounding).toBeUndefined();
    });

    it("exposes its leaves so boundGrounding's sweep recurses past the dispatcher", () => {
      const amount = v.float('amount', { min: 0, max: 1, hinted: 'x.cpp:1' });
      const family = indexedFamilyValidator({
        prefix: 'settings/',
        leaves: { amount },
        unknownCode: 'INVALID_SETTING',
        describes: 'setting',
      });
      expect(family.leaves).toEqual([amount]);
    });
  });

  it('cannot resolve an inherited Object member as a leaf', () => {
    const family = indexedFamilyValidator({
      prefix: 'settings/',
      leaves: {},
      unknownCode: 'INVALID_SETTING',
      describes: 'setting',
    });
    const spy = vi.spyOn(Object.prototype, 'toString');
    expect(family('settings/0/toString', '1', 1)?.code).toBe('INVALID_SETTING');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  describe('a trailing segment past the leaf', () => {
    it('reaches the leaf under a hand-rolled _set, which reads one fixed slice', () => {
      // `get_slicec('/', 2)` returns `root_bone` for `settings/0/root_bone/extra`
      // exactly as it does for `settings/0/root_bone`, and the branch below it
      // calls the setter either way (bone_twist_disperser_3d.cpp:37-40).
      const leaf = probe();
      const family = indexedFamilyValidator({
        prefix: 'settings/',
        leaves: { root_bone: leaf },
        unknownCode: 'INVALID_SETTING',
        describes: 'setting',
        indexParse: 'to_int',
      });
      expect(family('settings/0/root_bone/extra', '1', 3)).toBeNull();
      expect(leaf.calls).toContain('settings/0/root_bone/extra');
    });

    it('resolves at the family own leaf depth, not at the first slash', () => {
      const leaf = probe();
      const family = indexedFamilyValidator({
        prefix: 'settings/',
        leaves: { 'position/enabled': leaf },
        unknownCode: 'INVALID_SETTING',
        describes: 'setting',
        indexParse: 'to_int',
      });
      expect(family('settings/0/position/enabled/extra', 'true', 3)).toBeNull();
      expect(leaf.calls).toContain('settings/0/position/enabled/extra');
      expect(family('settings/0/position/other', 'true', 3)?.code).toBe('INVALID_SETTING');
    });

    it('does not swallow the tail of a branch that reads below itself', () => {
      // `end_bone` is a branch, not a terminal leaf: `_set` reads an option at
      // slice 3 and returns false for one it does not know
      // (two_bone_ik_3d.cpp:57-70). The declared `end_bone/direction` beside it
      // is what says so.
      const bone = probe();
      const direction = probe();
      const family = indexedFamilyValidator({
        prefix: 'settings/',
        leaves: { end_bone: bone, 'end_bone/direction': direction },
        unknownCode: 'INVALID_SETTING',
        describes: 'setting',
        indexParse: 'to_int',
      });
      expect(family('settings/0/end_bone/not_an_option', '1', 3)?.code).toBe('INVALID_SETTING');
      expect(family('settings/0/end_bone', '1', 3)).toBeNull();
      expect(family('settings/0/end_bone/direction/extra', '1', 3)).toBeNull();
      expect(direction.calls).toContain('settings/0/end_bone/direction/extra');
    });

    it('stays unknown under the PropertyListHelper parse, which cuts at the last slash', () => {
      // `rsplit("/", true, 1)` leaves `0/text` as the index text, `is_valid_int`
      // refuses it and no write lands (property_list_helper.cpp:47-55).
      const leaf = probe();
      const family = indexedFamilyValidator({
        prefix: 'item_',
        leaves: { text: leaf },
        unknownCode: 'INVALID_ITEM',
        describes: 'item',
      });
      expect(family('item_0/text/extra', '"hi"', 1)?.code).toBe('INVALID_ITEM');
      expect(leaf.calls).toHaveLength(0);
    });
  });
});
