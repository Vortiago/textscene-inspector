import { describe, expect, it } from 'vitest';
import { mergeDisjoint } from './mergeDisjoint.js';

describe('mergeDisjoint', () => {
  it('merges parts that share no key', () => {
    expect(mergeDisjoint([{ a: 1 }, { b: 2 }, { c: 3 }], 'rows')).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('throws on a key two parts both declare, naming the key', () => {
    expect(() => mergeDisjoint([{ a: 1 }, { a: 2 }], 'census rows')).toThrow(
      'a has census rows in two parts'
    );
  });

  it('merges no parts into an empty table', () => {
    expect(mergeDisjoint([], 'rows')).toEqual({});
  });

  // The keys are Godot names, so a name that also lives on `Object.prototype`
  // is reachable and must read as undeclared until this table declares it.
  it('accepts a single declaration of an Object.prototype name', () => {
    expect(mergeDisjoint([{ toString: 1 }, { valueOf: 2 }, { constructor: 3 }], 'rows')).toEqual({
      toString: 1,
      valueOf: 2,
      constructor: 3,
    });
  });

  it('keeps `__proto__` as data rather than assigning through the setter', () => {
    const merged = mergeDisjoint([{ ['__proto__']: 1 }, { b: 2 }], 'rows');

    expect(Object.hasOwn(merged, '__proto__')).toBe(true);
    expect(merged['__proto__']).toBe(1);
  });

  it('refuses `__proto__` declared twice, like any other key', () => {
    expect(() => mergeDisjoint([{ ['__proto__']: 1 }, { ['__proto__']: 2 }], 'rows')).toThrow(
      '__proto__ has rows in two parts'
    );
  });

  it('still refuses an Object.prototype name declared twice', () => {
    expect(() => mergeDisjoint([{ toString: 1 }, { toString: 2 }], 'rows')).toThrow(
      'toString has rows in two parts'
    );
  });
});
