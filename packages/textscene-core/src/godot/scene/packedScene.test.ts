import { describe, expect, it } from 'vitest';
import {
  parseIdTrail,
  parseUniqueId,
  recoverByIdTrail,
  reparentedName,
  type IdHeading,
} from './packedScene.js';

describe('parseIdTrail', () => {
  it('reads the ids of a PackedInt32Array', () => {
    expect(parseIdTrail('PackedInt32Array(1, 2)')).toEqual([1, 2]);
  });

  it('reads an empty array as an empty trail', () => {
    expect(parseIdTrail('PackedInt32Array()')).toEqual([]);
  });

  it('reports no trail where the heading has none', () => {
    expect(parseIdTrail(undefined)).toBeUndefined();
  });

  it('reads ids padded with whitespace', () => {
    expect(parseIdTrail('PackedInt32Array( 1 , 2 )')).toEqual([1, 2]);
  });

  it('reads an id Godot cannot store as INT32_MIN', () => {
    expect(parseIdTrail('PackedInt32Array(inf, nan)')).toEqual([-2147483648, -2147483648]);
  });

  it('reads a negative id', () => {
    expect(parseIdTrail('PackedInt32Array(-5)')).toEqual([-5]);
  });

  it.each(['PackedInt32Array(1, x)', 'PackedInt32Array(1,, 2)', 'PackedInt32Array(true)', '[1, 2]', ''])(
    'reports no trail for %j',
    (literal) => {
      expect(parseIdTrail(literal)).toBeUndefined();
    }
  );
});

describe('parseUniqueId', () => {
  it('reads the integer a heading carries', () => {
    expect(parseUniqueId('1234')).toBe(1234);
  });

  it.each([
    ['inf', -2147483648],
    ['-inf', -2147483648],
    ['nan', -2147483648],
    ['3000000000', -1294967296],
    ['2.9', 2],
  ])('reads %s as the %i Godot 4.6.3 stores', (literal, stored) => {
    expect(parseUniqueId(literal)).toBe(stored);
  });

  it('reads a bool as the 1 or 0 the int conversion stores (edge case)', () => {
    // `unique_id = next_tag.fields["unique_id"]` (resource_format_text.cpp:214-215) is Variant's `operator int`.
    expect([parseUniqueId('true'), parseUniqueId('false')]).toEqual([1, 0]);
  });

  it.each([undefined, '', 'abc'])('reads %j as unassigned', (literal) => {
    expect(parseUniqueId(literal)).toBe(0);
  });
});

describe('recoverByIdTrail', () => {
  const recoverOver = (trail: readonly number[], headings: readonly IdHeading[], builtCount: number) =>
    recoverByIdTrail(
      trail,
      (id) => {
        const index = headings.findIndex((heading) => heading.uniqueId === id);
        return index === -1 ? undefined : index;
      },
      (index) => headings[index]!,
      builtCount
    );
  const plain = (uniqueId: number): IdHeading => ({ uniqueId, instance: undefined, isPlaced: true });
  const orphan = plain(0);

  it('lands under the heading a one-id trail names, when it comes first and is placed', () => {
    const headings = [plain(10), plain(20), orphan];
    expect(recoverOver([20], headings, 2)).toEqual({ kind: 'lands', heading: 1 });
  });

  it('fails when no heading carries the first id', () => {
    expect(recoverOver([99], [plain(10), orphan], 1)).toBeUndefined();
  });

  it('fails when the named heading comes after the orphan', () => {
    expect(recoverOver([20], [plain(10), orphan, plain(20)], 1)).toBeUndefined();
  });

  it('fails when the named heading is itself unplaced', () => {
    const unplaced: IdHeading = { uniqueId: 20, instance: undefined, isPlaced: false };
    expect(recoverOver([20], [plain(10), unplaced, orphan], 2)).toBeUndefined();
  });

  it('fails for an empty trail', () => {
    expect(recoverOver([], [plain(10), orphan], 1)).toBeUndefined();
  });

  it('matches id 0 to the first heading without a unique_id', () => {
    expect(recoverOver([0], [plain(10), plain(0), orphan], 2)).toEqual({ kind: 'lands', heading: 1 });
  });

  it('fails when a middle hop is not an instance', () => {
    expect(recoverOver([10, 5], [plain(10), orphan], 1)).toBeUndefined();
  });

  it('fails when a middle hop is a placeholder', () => {
    const placeholder: IdHeading = { uniqueId: 10, instance: 'placeholder', isPlaced: true };
    expect(recoverOver([10, 5], [placeholder, orphan], 1)).toBeUndefined();
  });

  it('fails when the instance a middle hop names comes after the orphan', () => {
    const instance: IdHeading = { uniqueId: 10, instance: 'scene', isPlaced: true };
    expect(recoverOver([10, 5], [orphan, instance], 0)).toBeUndefined();
  });

  it('fails when the instance a middle hop names is itself unplaced', () => {
    const instance: IdHeading = { uniqueId: 10, instance: 'scene', isPlaced: false };
    expect(recoverOver([10, 5], [instance, orphan], 1)).toBeUndefined();
  });

  it('reports the instance a middle hop names, as the rest lives in its scene', () => {
    const instance: IdHeading = { uniqueId: 10, instance: 'scene', isPlaced: true };
    expect(recoverOver([10, 5], [instance, orphan], 1)).toEqual({ kind: 'inBase', heading: 0 });
  });
});

describe('reparentedName', () => {
  it('joins the vanished path and the name with `#`', () => {
    expect(reparentedName('Gone', 'Orphan')).toBe('Gone#Orphan');
  });

  it('strips a leading `./`, which the loader prepends to a relative path', () => {
    expect(reparentedName('./Gone', 'Orphan')).toBe('Gone#Orphan');
  });

  it('turns `/` into `@`, which `set_name` then replaces with `_`', () => {
    expect(reparentedName('Gone/Deeper', 'Name')).toBe('Gone_Deeper#Name');
  });

  it('ignores a trailing slash, which the NodePath drops (edge case)', () => {
    expect(reparentedName('Gone/', 'Leaf')).toBe('Gone#Leaf');
  });

  it('keeps the root of an absolute path as `_` (edge case)', () => {
    expect(reparentedName('/root/Gone', 'Leaf')).toBe('___root_Gone#Leaf');
  });
});
