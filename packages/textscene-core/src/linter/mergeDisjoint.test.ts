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

  // Both keys come from a table keyed by a Godot name, so a name that also
  // lives on `Object.prototype` is reachable. `key in merged` answered true for
  // its FIRST declaration and threw at import time, taking the linter barrel
  // with it; the membership test has to be own-keys-only, like the
  // `Object.entries` it is compared against.
  it('accepts a single declaration of an Object.prototype name', () => {
    expect(mergeDisjoint([{ toString: 1 }, { valueOf: 2 }, { constructor: 3 }], 'rows')).toEqual({
      toString: 1,
      valueOf: 2,
      constructor: 3,
    });
  });

  it('still refuses an Object.prototype name declared twice', () => {
    expect(() => mergeDisjoint([{ toString: 1 }, { toString: 2 }], 'rows')).toThrow(
      'toString has rows in two parts'
    );
  });
});
