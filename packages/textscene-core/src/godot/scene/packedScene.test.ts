import { describe, expect, it } from 'vitest';
import { parseIdTrail, parseUniqueId, recoverByIdTrail, type IdHeading } from './packedScene.js';

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

  it.each(['PackedInt32Array(1, x)', 'PackedInt32Array(1,, 2)', '[1, 2]', ''])(
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

  it.each([undefined, '', 'abc'])('reads %j as unassigned', (literal) => {
    expect(parseUniqueId(literal)).toBe(0);
  });
});

describe('recoverByIdTrail', () => {
  const plain = (uniqueId: number): IdHeading => ({ uniqueId, instance: undefined, isPlaced: true });
  const orphan = plain(0);

  it('lands under the heading a one-id trail names, when it comes first and is placed', () => {
    const headings = [plain(10), plain(20), orphan];
    expect(recoverByIdTrail([20], headings, 2)).toEqual({ kind: 'lands', heading: 1 });
  });

  it('fails when no heading carries the first id', () => {
    expect(recoverByIdTrail([99], [plain(10), orphan], 1)).toBeUndefined();
  });

  it('fails when the named heading comes after the orphan', () => {
    expect(recoverByIdTrail([20], [plain(10), orphan, plain(20)], 1)).toBeUndefined();
  });

  it('fails when the named heading is itself unplaced', () => {
    const unplaced: IdHeading = { uniqueId: 20, instance: undefined, isPlaced: false };
    expect(recoverByIdTrail([20], [plain(10), unplaced, orphan], 2)).toBeUndefined();
  });

  it('fails for an empty trail', () => {
    expect(recoverByIdTrail([], [plain(10), orphan], 1)).toBeUndefined();
  });

  it('matches id 0 to the first heading without a unique_id', () => {
    expect(recoverByIdTrail([0], [plain(10), plain(0), orphan], 2)).toEqual({ kind: 'lands', heading: 1 });
  });

  it('fails when a middle hop is not an instance', () => {
    expect(recoverByIdTrail([10, 5], [plain(10), orphan], 1)).toBeUndefined();
  });

  it('fails when a middle hop is a placeholder', () => {
    const placeholder: IdHeading = { uniqueId: 10, instance: 'placeholder', isPlaced: true };
    expect(recoverByIdTrail([10, 5], [placeholder, orphan], 1)).toBeUndefined();
  });

  it('fails when the instance a middle hop names comes after the orphan', () => {
    const instance: IdHeading = { uniqueId: 10, instance: 'scene', isPlaced: true };
    expect(recoverByIdTrail([10, 5], [orphan, instance], 0)).toBeUndefined();
  });

  it('fails when the instance a middle hop names is itself unplaced', () => {
    const instance: IdHeading = { uniqueId: 10, instance: 'scene', isPlaced: false };
    expect(recoverByIdTrail([10, 5], [instance, orphan], 1)).toBeUndefined();
  });

  it('reports the instance a middle hop names, as the rest lives in its scene', () => {
    const instance: IdHeading = { uniqueId: 10, instance: 'scene', isPlaced: true };
    expect(recoverByIdTrail([10, 5], [instance, orphan], 1)).toEqual({ kind: 'inBase', heading: 0 });
  });
});
