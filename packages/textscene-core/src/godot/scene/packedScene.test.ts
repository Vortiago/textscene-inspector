import { describe, expect, it } from 'vitest';
import {
  followContentTrail,
  parseIdTrail,
  parseUniqueId,
  recoverByIdTrail,
  reparentedName,
  type IdHeading,
  type SceneLookup,
  type TrailHeading,
  type TrailScene,
} from './packedScene.js';
import { firstIndexWith } from '../../utils/keyedLookup.js';

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
  const firstIndexWithId = firstIndexWith((heading: IdHeading) => heading.uniqueId);
  const recoverIn = (trail: readonly number[], headings: readonly IdHeading[], builtCount: number) =>
    recoverByIdTrail(
      trail,
      (id) => firstIndexWithId(headings, id),
      (index) => headings[index]!,
      builtCount
    );
  const plain = (uniqueId: number): IdHeading => ({ uniqueId, instance: undefined, isPlaced: true });
  const orphan = plain(0);

  it('reads each heading id a bounded number of times however many trails it follows', () => {
    let reads = 0;
    const counted = (uniqueId: number): IdHeading =>
      Object.defineProperty({ instance: undefined, isPlaced: true } as IdHeading, 'uniqueId', {
        get: () => {
          reads++;
          return uniqueId;
        },
      });
    const headings = Array.from({ length: 500 }, (_, i) => counted(i + 1));

    for (let i = 0; i < 500; i++) recoverIn([i + 1], headings, headings.length);

    expect(reads).toBeLessThanOrEqual(2 * headings.length);
  });

  it('lands under the heading a one-id trail names, when it comes first and is placed', () => {
    const headings = [plain(10), plain(20), orphan];
    expect(recoverIn([20], headings, 2)).toEqual({ kind: 'lands', heading: 1 });
  });

  it('fails when no heading carries the first id', () => {
    expect(recoverIn([99], [plain(10), orphan], 1)).toBeUndefined();
  });

  it('continues the whole trail in the base scene where the root inherits one and no heading carries the id', () => {
    const inheritingRoot: IdHeading = { uniqueId: 10, instance: 'scene', isPlaced: true };
    expect(recoverIn([99, 5], [inheritingRoot, orphan], 1)).toEqual({
      kind: 'inBase',
      heading: 0,
      rest: [99, 5],
    });
  });

  it('fails when the id is no heading and the root inherits nothing', () => {
    expect(recoverIn([99, 5], [plain(10), orphan], 1)).toBeUndefined();
  });

  it('fails when the named heading comes after the orphan', () => {
    expect(recoverIn([20], [plain(10), orphan, plain(20)], 1)).toBeUndefined();
  });

  it('fails when the named heading is itself unplaced', () => {
    const unplaced: IdHeading = { uniqueId: 20, instance: undefined, isPlaced: false };
    expect(recoverIn([20], [plain(10), unplaced, orphan], 2)).toBeUndefined();
  });

  it('fails for an empty trail', () => {
    expect(recoverIn([], [plain(10), orphan], 1)).toBeUndefined();
  });

  it('matches id 0 to the first heading without a unique_id', () => {
    expect(recoverIn([0], [plain(10), plain(0), orphan], 2)).toEqual({ kind: 'lands', heading: 1 });
  });

  it('fails when a middle hop is not an instance', () => {
    expect(recoverIn([10, 5], [plain(10), orphan], 1)).toBeUndefined();
  });

  it('fails when a middle hop is a placeholder', () => {
    const placeholder: IdHeading = { uniqueId: 10, instance: 'placeholder', isPlaced: true };
    expect(recoverIn([10, 5], [placeholder, orphan], 1)).toBeUndefined();
  });

  it('fails when the instance a middle hop names comes after the orphan', () => {
    const instance: IdHeading = { uniqueId: 10, instance: 'scene', isPlaced: true };
    expect(recoverIn([10, 5], [orphan, instance], 0)).toBeUndefined();
  });

  it('fails when the instance a middle hop names is itself unplaced', () => {
    const instance: IdHeading = { uniqueId: 10, instance: 'scene', isPlaced: false };
    expect(recoverIn([10, 5], [instance, orphan], 1)).toBeUndefined();
  });

  it('reports the instance a middle hop names, with the rest of the trail that lives in its scene', () => {
    const instance: IdHeading = { uniqueId: 10, instance: 'scene', isPlaced: true };
    expect(recoverIn([10, 5, 6], [instance, orphan], 1)).toEqual({
      kind: 'inBase',
      heading: 0,
      rest: [5, 6],
    });
  });
});

describe('followContentTrail', () => {
  const heading = (uniqueId: number, path: string, instance?: TrailHeading['instance']): TrailHeading => ({
    uniqueId,
    path,
    instance,
    instanceRef: undefined,
  });

  /** A scene state over `headings`, whose instances and base answer from `lookups`. */
  function sceneOf(
    headings: readonly TrailHeading[],
    lookups: { instanced?: Record<number, SceneLookup>; base?: SceneLookup } = {}
  ): TrailScene {
    const firstIndexWithId = firstIndexWith((entry: TrailHeading) => entry.uniqueId);
    return {
      indexWithId: (id) => firstIndexWithId(headings, id),
      headingAt: (index) => headings[index]!,
      instancedScene: (index) => lookups.instanced?.[index] ?? 'missing',
      baseScene: () => lookups.base,
    };
  }

  it('gives the authored path of the heading a one-id trail names', () => {
    const scene = sceneOf([heading(1, ''), heading(5, 'Mid/Inner')]);
    expect(followContentTrail([5], scene)).toEqual({ status: 'found', path: 'Mid/Inner' });
  });

  it('joins the paths of the headings each hop names, through the instance in between', () => {
    const inner = sceneOf([heading(1, ''), heading(7, 'Deep')]);
    const outer = sceneOf([heading(1, ''), heading(5, 'Mid', 'scene')], { instanced: { 1: inner } });
    expect(followContentTrail([5, 7], outer)).toEqual({ status: 'found', path: 'Mid/Deep' });
  });

  it('finds an id that only the base scene holds', () => {
    const base = sceneOf([heading(1, ''), heading(9, 'Core')]);
    const derived = sceneOf([heading(1, '')], { base });
    expect(followContentTrail([9], derived)).toEqual({ status: 'found', path: 'Core' });
  });

  it('finds an id in the base of the scene a middle hop instances', () => {
    const base = sceneOf([heading(1, ''), heading(9, 'Core')]);
    const derived = sceneOf([heading(1, '')], { base });
    const outer = sceneOf([heading(1, ''), heading(5, 'Mid', 'scene')], { instanced: { 1: derived } });
    expect(followContentTrail([5, 9], outer)).toEqual({ status: 'found', path: 'Mid/Core' });
  });

  it('takes the first heading that carries the id', () => {
    const scene = sceneOf([heading(1, ''), heading(5, 'First'), heading(5, 'Second')]);
    expect(followContentTrail([5], scene)).toEqual({ status: 'found', path: 'First' });
  });

  it('matches id 0 to the first heading without a unique_id', () => {
    const scene = sceneOf([heading(3, 'Tagged'), heading(0, 'Bare')]);
    expect(followContentTrail([0], scene)).toEqual({ status: 'found', path: 'Bare' });
  });

  it('fails where no heading, and no base, carries the id', () => {
    const base = sceneOf([heading(1, '')]);
    expect(followContentTrail([9], sceneOf([heading(1, '')], { base }))).toEqual({ status: 'missing' });
  });

  it('fails for an empty trail', () => {
    expect(followContentTrail([], sceneOf([heading(1, '')]))).toEqual({ status: 'missing' });
  });

  it.each<[string, TrailHeading['instance']]>([
    ['is no instance', undefined],
    ['is a placeholder (packed_scene.cpp:1997)', 'placeholder'],
  ])('fails where a middle hop %s', (_name, instance) => {
    const scene = sceneOf([heading(1, ''), heading(5, 'Mid', instance)]);
    expect(followContentTrail([5, 7], scene)).toEqual({ status: 'missing' });
  });

  it('waits for an instanced scene that is not loaded yet', () => {
    const scene = sceneOf([heading(1, ''), heading(5, 'Mid', 'scene')], { instanced: { 1: 'pending' } });
    expect(followContentTrail([5, 7], scene)).toEqual({ status: 'pending' });
  });

  it('waits for a base that is not loaded yet', () => {
    expect(followContentTrail([9], sceneOf([heading(1, '')], { base: 'pending' }))).toEqual({
      status: 'pending',
    });
  });

  it('fails where the instanced scene failed to load', () => {
    const scene = sceneOf([heading(1, ''), heading(5, 'Mid', 'scene')], { instanced: { 1: 'missing' } });
    expect(followContentTrail([5, 7], scene)).toEqual({ status: 'missing' });
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
